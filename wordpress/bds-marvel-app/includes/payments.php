<?php
if (!defined('ABSPATH')) { exit; }

function bds_payment_install() {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    dbDelta("CREATE TABLE {$wpdb->prefix}bds_payment_events (
        id varchar(64) NOT NULL,
        body_hash varchar(64) NOT NULL,
        event_type varchar(40) NOT NULL,
        created_at datetime NOT NULL,
        PRIMARY KEY  (id)
    ) $charset;");
}
function bds_payment_matches($data, $payment) {
    return is_array($data) && is_array($payment) && ($data['payment_provider'] ?? '') === 'razorpay'
        && !empty($data['razorpay_order_id']) && ($payment['order_id'] ?? '') === $data['razorpay_order_id']
        && preg_match('/^pay_[A-Za-z0-9]+$/', $payment['id'] ?? '')
        && (int) ($payment['amount'] ?? 0) === (int) $data['total'] * 100
        && ($payment['currency'] ?? '') === 'INR';
}
function bds_apply_captured_payment($id, $payment) {
    global $wpdb;
    $table = $wpdb->prefix . 'bds_bookings';
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %s", $id), ARRAY_A);
    if (!$row) { return bds_error('Booking not found.', 404); }
    $lock = bds_lock($row['stay_slug']);
    if (!$lock) { return bds_error('Payment verification is busy. Please retry.', 409); }
    try {
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %s", $id), ARRAY_A);
        $data = bds_booking_row($row);
        if (!bds_payment_matches($data, $payment) || ($payment['status'] ?? '') !== 'captured') { return bds_error('Captured payment does not match this booking.', 400); }
        if (!empty($data['payment_id'])) {
            if ($data['payment_id'] !== $payment['id']) { return bds_error('This booking already has a different payment.', 409); }
            // Captured callbacks arriving after refunds/cancellation must not regress state.
            return $data;
        }
        $data['payment_id'] = $payment['id']; $data['paid_at'] = gmdate('c');
        $data['payment_status'] = 'paid';
        if (in_array($row['status'], array('cancelled','declined'), true)) {
            $data['refund_attention'] = 'Payment arrived after the booking closed. Review and arrange a refund.';
        } elseif (bds_active_overlap($row['stay_slug'], $row['check_in'], $row['check_out'], $id)) {
            $data['status'] = 'payment_conflict'; $data['payment_status'] = 'paid_conflict';
            $data['refund_attention'] = 'Captured payment conflicts with another reservation. Arrange a refund.';
        } else { $data['status'] = ($data['mode'] ?? 'request') === 'instant' ? 'confirmed' : 'requested'; }
        if ($wpdb->update($table, array('status' => $data['status'], 'data' => wp_json_encode($data)), array('id' => $id)) === false) { return bds_error('Could not save payment. Please retry.', 500); }
        bds_audit($id, 'payment_captured');
        bds_notify($data, 'BDS Marvel — payment recorded (' . $data['reference'] . ')', true);
        return $data;
    } finally { bds_unlock($lock); }
}
function bds_find_payment_booking($order_id) {
    global $wpdb;
    if (!preg_match('/^order_[A-Za-z0-9]+$/', $order_id)) { return null; }
    $table = $wpdb->prefix . 'bds_bookings';
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE payment_order_id = %s LIMIT 1", $order_id), ARRAY_A);
    if ($row) { return $row; }
    // Compatibility for bookings created before the indexed order column existed.
    $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $table WHERE payment_order_id IS NULL AND data LIKE %s", '%' . $wpdb->esc_like($order_id) . '%'), ARRAY_A);
    foreach ($rows as $row) {
        $data = json_decode($row['data'], true);
        if (($data['razorpay_order_id'] ?? '') === $order_id) {
            $wpdb->update($table, array('payment_order_id' => $order_id), array('id' => $row['id'])); return $row;
        }
    }
    return null;
}
function bds_webhook_permission($request) {
    $body = $request->get_body();
    $secret = (string) get_option('bds_razorpay_webhook_secret', '');
    $signature = $request->get_header('X-Razorpay-Signature');
    if (strlen($body) > 262144) { return new WP_Error('bds_payload', 'Webhook too large.', array('status' => 413)); }
    if (!$secret || !preg_match('/^[a-f0-9]{64}$/i', $signature) || !hash_equals(hash_hmac('sha256', $body, $secret), strtolower($signature))) {
        return new WP_Error('bds_signature', 'Invalid webhook signature.', array('status' => 401));
    }
    return true;
}
function bds_payment_webhook($request) {
    global $wpdb;
    $permission = bds_webhook_permission($request);
    if (is_wp_error($permission)) { return $permission; }
    $event = json_decode($request->get_body(), true);
    $event_id = $request->get_header('X-Razorpay-Event-Id');
    if (!is_array($event) || !is_string($event_id) || !$event_id || strlen($event_id) > 255) { return bds_error('Invalid webhook event.', 400); }
    $key = hash('sha256', $event_id); $hash = hash('sha256', $request->get_body());
    $table = $wpdb->prefix . 'bds_payment_events';
    $old = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %s", $key), ARRAY_A);
    if ($old) { return hash_equals($old['body_hash'], $hash) ? array('received' => true, 'duplicate' => true) : bds_error('Event ID reused with a different body.', 409); }
    $type = $event['event'] ?? '';
    if (!in_array($type, array('payment.captured', 'refund.processed', 'refund.failed'), true)) { return array('received' => true, 'ignored' => true); }
    if ($type === 'payment.captured') {
        $payment = $event['payload']['payment']['entity'] ?? null;
        if (!is_array($payment)) { return bds_error('Missing payment entity.', 400); }
        $row = bds_find_payment_booking($payment['order_id'] ?? '');
        if (!$row) { return array('received' => true, 'ignored' => true); }
        $result = bds_apply_captured_payment($row['id'], $payment);
    } else {
        $refund = $event['payload']['refund']['entity'] ?? array();
        if (!preg_match('/^pay_[A-Za-z0-9]+$/', $refund['payment_id'] ?? '')) { return bds_error('Invalid refund entity.', 400); }
        // Read the current provider state: event delivery can be out of order.
        $payment = bds_razorpay_result(bds_razorpay_request('GET', 'payments/' . rawurlencode($refund['payment_id'])));
        if (!$payment) { return bds_error('Payment service unavailable. Retry delivery.', 503); }
        $row = bds_find_payment_booking($payment['order_id'] ?? '');
        if (!$row) { return array('received' => true, 'ignored' => true); }
        $result = bds_apply_refund_state($row['id'], $payment, $type === 'refund.failed');
    }
    if ($result instanceof WP_REST_Response && $result->get_status() >= 400 || is_wp_error($result)) { return $result; }
    $saved = $wpdb->insert($table, array('id' => $key, 'body_hash' => $hash, 'event_type' => $type, 'created_at' => gmdate('Y-m-d H:i:s')));
    if (!$saved && !$wpdb->get_var($wpdb->prepare("SELECT id FROM $table WHERE id = %s", $key))) { return bds_error('Could not record webhook receipt. Retry delivery.', 500); }
    update_option('bds_webhook_last_received', time(), false);
    return array('received' => true);
}
function bds_apply_refund_state($id, $payment, $failed = false) {
    global $wpdb;
    $table = $wpdb->prefix . 'bds_bookings';
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %s", $id), ARRAY_A);
    if (!$row) { return bds_error('Booking not found.', 404); }
    $lock = bds_lock($row['stay_slug']);
    if (!$lock) { return bds_error('Booking busy. Retry shortly.', 409); }
    try {
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %s", $id), ARRAY_A);
        $data = bds_booking_row($row);
        if (!bds_payment_matches($data, $payment) || !empty($data['payment_id']) && $data['payment_id'] !== $payment['id']) { return bds_error('Refund payment does not match.', 400); }
        $refunded = max(0, (int) ($payment['amount_refunded'] ?? 0));
        if ($refunded > (int) $data['total'] * 100) { return bds_error('Invalid refunded amount.', 400); }
        // Provider snapshots may race. Never reduce an already recorded refund.
        $refunded = max($refunded, (int) ($data['refunded_amount_paise'] ?? 0));
        if (!$refunded && !$failed) { return $data; }
        if (!$refunded && ($data['payment_status'] ?? '') === 'refunded') { return $data; }
        $new = $refunded >= (int) $data['total'] * 100 ? 'refunded' : ($refunded > 0 ? 'partially_refunded' : 'refund_failed');
        if (($data['payment_status'] ?? '') === $new && (int) ($data['refunded_amount_paise'] ?? 0) === $refunded) { return $data; }
        $data['payment_id'] = $payment['id']; $data['payment_status'] = $new; $data['refunded_amount_paise'] = $refunded;
        if ($new === 'refunded') { unset($data['refund_attention']); if (!in_array($data['status'], array('declined','cancelled'), true)) { $data['status'] = 'cancelled'; } }
        else { $data['refund_attention'] = $new === 'refund_failed' ? 'Refund failed. Review in Razorpay.' : 'Partial refund recorded. Review the remaining balance.'; }
        if ($wpdb->update($table, array('status' => $data['status'], 'data' => wp_json_encode($data)), array('id' => $id)) === false) { return bds_error('Could not save refund state.', 500); }
        bds_audit($id, $new); bds_notify($data, 'BDS Marvel — refund update (' . $data['reference'] . ')', true);
        return $data;
    } finally { bds_unlock($lock); }
}
function bds_refund_declined_booking($id) {
    global $wpdb;
    $table = $wpdb->prefix . 'bds_bookings';
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %s", $id), ARRAY_A);
    if (!$row) { return bds_error('Booking not found.', 404); }
    $lock = bds_lock($row['stay_slug']);
    if (!$lock) { return bds_booking_row($row); }
    try {
        $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %s", $id), ARRAY_A); $data = bds_booking_row($row);
        if ($data['status'] !== 'declined' || ($data['payment_status'] ?? '') !== 'paid' || empty($data['payment_id'])) { return $data; }
        $refund = bds_razorpay_result(bds_razorpay_request('POST', 'payments/' . rawurlencode($data['payment_id']) . '/refund', array('amount' => (int) $data['total'] * 100,
            'notes' => array('booking_reference' => $data['reference'], 'reason' => 'Stay request declined by host')),
            array('X-Refund-Idempotency' => 'bds-decline-' . $id)));
        if ($refund && !empty($refund['id'])) { $data['payment_status'] = 'refund_pending'; $data['refund_id'] = $refund['id']; $data['refund_requested_at'] = gmdate('c'); }
        else { $data['payment_status'] = 'refund_failed'; $data['refund_attention'] = 'Check Razorpay refund status before arranging any manual refund.'; }
        if ($wpdb->update($table, array('data' => wp_json_encode($data)), array('id' => $id)) === false) { return bds_error('Refund needs owner review.', 500); }
        bds_audit($id, $data['payment_status']); return $data;
    } finally { bds_unlock($lock); }
}
add_action('rest_api_init', function () {
    register_rest_route('bds/v1', '/payments/razorpay/webhook', array('methods' => 'POST', 'permission_callback' => 'bds_webhook_permission', 'callback' => 'bds_payment_webhook'));
});

function bds_reconcile_booking($id) {
    global $wpdb;
    if (!current_user_can('manage_options')) { return bds_error('Owner access required.', 403); }
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_bookings WHERE id = %s", $id), ARRAY_A);
    if (!$row) { return bds_error('Booking not found.', 404); }
    $data = bds_booking_row($row);
    $order = $data['razorpay_order_id'] ?? '';
    if (!preg_match('/^order_[A-Za-z0-9]+$/', $order)) { return bds_error('This booking has no payment order.', 400); }
    $payments = bds_razorpay_result(bds_razorpay_request('GET', 'orders/' . rawurlencode($order) . '/payments'));
    if (!$payments || !isset($payments['items'])) { return bds_error('Payment service unavailable. Try again later.', 503); }
    foreach ($payments['items'] as $payment) {
        if (!bds_payment_matches($data, $payment) || !empty($data['payment_id']) && $data['payment_id'] !== $payment['id']) { continue; }
        if (($payment['status'] ?? '') === 'captured' || ($payment['status'] ?? '') === 'refunded') {
            if ((int) ($payment['amount_refunded'] ?? 0) > 0) { return bds_apply_refund_state($id, $payment); }
            return bds_apply_captured_payment($id, $payment);
        }
    }
    return bds_error('No captured payment was found. Review the order in Razorpay.', 409);
}
function bds_payment_operations() {
    if (!current_user_can('manage_options')) { return; }
    global $wpdb;
    echo '<h2>Payments and reconciliation</h2><p>Webhook endpoint: <code>' . esc_html(rest_url('bds/v1/payments/razorpay/webhook')) . '</code></p>';
    echo '<p>Webhook secret: ' . (get_option('bds_razorpay_webhook_secret', '') ? 'Configured' : 'Missing — configure under BDS Marvel settings') . '</p>';
    $last = (int) get_option('bds_webhook_last_received', 0);
    echo '<p>Last accepted event: ' . esc_html($last ? gmdate('Y-m-d H:i:s', $last) . ' UTC' : 'None yet') . '</p>';
    if (isset($_POST['bds_reconcile_booking'])) {
        check_admin_referer('bds_reconcile_booking');
        $result = bds_reconcile_booking(sanitize_text_field(wp_unslash($_POST['bds_reconcile_booking'])));
        $error = $result instanceof WP_REST_Response || is_wp_error($result);
        $message = is_wp_error($result) ? $result->get_error_message() : ($result instanceof WP_REST_Response ? ($result->get_data()['detail'] ?? 'Could not reconcile payment.') : 'Payment state reconciled.');
        echo '<div class="notice ' . ($error ? 'notice-error' : 'notice-success') . '"><p>' . esc_html($message) . '</p></div>';
    }
    $rows = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}bds_bookings ORDER BY created_at DESC LIMIT 100", ARRAY_A);
    echo '<p>Latest payment orders (up to 100 recent bookings). Reconcile reads provider state; it does not create a charge or initiate a refund.</p>';
    foreach ($rows as $row) {
        $data = bds_booking_row($row); if (empty($data['razorpay_order_id'])) { continue; }
        echo '<form method="post"><p>' . esc_html(($data['reference'] ?? $row['id']) . ' · ' . $row['status'] . ' · ' . ($data['payment_status'] ?? 'unknown'));
        if (!empty($data['refund_attention'])) { echo ' — ' . esc_html($data['refund_attention']); }
        wp_nonce_field('bds_reconcile_booking');
        echo ' <button class="button" name="bds_reconcile_booking" value="' . esc_attr($row['id']) . '">Reconcile payment</button></p></form>';
    }
}
