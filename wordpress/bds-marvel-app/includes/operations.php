<?php
if (!defined('ABSPATH')) { exit; }

function bds_operations_install() {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    // dbDelta adds these columns to existing records without replacing submissions.
    dbDelta("CREATE TABLE {$wpdb->prefix}bds_enquiries (
        id varchar(36) NOT NULL,
        type varchar(40) NOT NULL,
        created_at datetime NOT NULL,
        data longtext NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'new',
        notes text DEFAULT NULL,
        updated_at datetime DEFAULT NULL,
        PRIMARY KEY  (id),
        KEY workflow (status,created_at)
    ) $charset;");
    dbDelta("CREATE TABLE {$wpdb->prefix}bds_mail_queue (
        id varchar(36) NOT NULL,
        record_id varchar(36) NOT NULL DEFAULT '',
        status varchar(20) NOT NULL DEFAULT 'queued',
        attempts int unsigned NOT NULL DEFAULT 0,
        available_at datetime NOT NULL,
        updated_at datetime NOT NULL,
        created_at datetime NOT NULL,
        payload longtext NOT NULL,
        PRIMARY KEY  (id),
        KEY dispatch (status,available_at),
        KEY record_id (record_id)
    ) $charset;");
    dbDelta("CREATE TABLE {$wpdb->prefix}bds_audit (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint unsigned NOT NULL DEFAULT 0,
        record_id varchar(36) NOT NULL,
        action varchar(60) NOT NULL,
        created_at datetime NOT NULL,
        PRIMARY KEY  (id),
        KEY record_id (record_id)
    ) $charset;");
}
function bds_audit($record_id, $action) {
    global $wpdb;
    $user = bds_user();
    return $wpdb->insert($wpdb->prefix . 'bds_audit', array('user_id' => $user ? $user->ID : 0,
        'record_id' => $record_id, 'action' => $action, 'created_at' => gmdate('Y-m-d H:i:s')));
}
function bds_queue_mail($to, $subject, $message, $headers = array(), $record_id = '') {
    global $wpdb;
    if (!is_email($to)) { bds_audit($record_id, 'mail_invalid_recipient'); return false; }
    $now = gmdate('Y-m-d H:i:s');
    $saved = $wpdb->insert($wpdb->prefix . 'bds_mail_queue', array('id' => wp_generate_uuid4(),
        'record_id' => $record_id, 'status' => 'queued', 'attempts' => 0, 'available_at' => $now,
        'updated_at' => $now, 'created_at' => $now,
        'payload' => wp_json_encode(array('to' => $to, 'subject' => $subject, 'message' => $message, 'headers' => $headers))));
    if (!$saved) { bds_audit($record_id, 'mail_queue_write_failed'); return false; }
    // Avoid waiting for the recurring tick when traffic is available.
    if (!wp_next_scheduled('bds_mail_soon')) { wp_schedule_single_event(time() + 10, 'bds_mail_soon'); }
    return true;
}
function bds_mail_retry_delay($attempt) { return min(6 * HOUR_IN_SECONDS, 60 * (2 ** max(0, $attempt - 1))); }
function bds_process_mail() {
    global $wpdb;
    $table = $wpdb->prefix . 'bds_mail_queue';
    $now = gmdate('Y-m-d H:i:s');
    // Recover a worker interrupted before it recorded the transport result.
    $wpdb->query($wpdb->prepare("UPDATE $table SET status = IF(attempts >= 5, 'failed', 'queued'), updated_at = %s WHERE status = 'sending' AND updated_at < %s",
        $now, gmdate('Y-m-d H:i:s', time() - 15 * MINUTE_IN_SECONDS)));
    $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $table WHERE status = 'queued' AND available_at <= %s ORDER BY available_at ASC LIMIT 10", $now), ARRAY_A);
    foreach ($rows as $row) {
        // Atomic compare-and-set: overlapping cron runners cannot claim the same message.
        $claimed = $wpdb->query($wpdb->prepare("UPDATE $table SET status = 'sending', attempts = attempts + 1, updated_at = %s WHERE id = %s AND status = 'queued' AND available_at <= %s", $now, $row['id'], $now));
        if ($claimed !== 1) { continue; }
        $payload = json_decode($row['payload'], true);
        $sent = false;
        try {
            if (is_array($payload) && is_email($payload['to'] ?? '')) {
                $sent = wp_mail($payload['to'], $payload['subject'], $payload['message'], $payload['headers']);
            }
        } catch (Throwable $e) { $sent = false; }
        $attempt = (int) $row['attempts'] + 1;
        $status = $sent ? 'sent' : ($attempt >= 5 ? 'failed' : 'queued');
        $wpdb->update($table, array('status' => $status, 'updated_at' => gmdate('Y-m-d H:i:s'),
            'available_at' => gmdate('Y-m-d H:i:s', time() + bds_mail_retry_delay($attempt))), array('id' => $row['id'], 'status' => 'sending'));
        if ($status === 'failed') { bds_audit($row['record_id'], 'mail_failed'); }
    }
    update_option('bds_mail_last_run', time(), false);
    // Retain failed messages for review. Clear personal message content after 30 days for sent mail.
    $wpdb->query($wpdb->prepare("UPDATE $table SET payload = '' WHERE status = 'sent' AND updated_at < %s AND payload <> ''", gmdate('Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS)));
}
add_filter('cron_schedules', function ($schedules) {
    $schedules['bds_five_minutes'] = array('interval' => 5 * MINUTE_IN_SECONDS, 'display' => 'BDS every five minutes');
    return $schedules;
});
add_action('init', function () {
    if (!wp_next_scheduled('bds_mail_tick')) { wp_schedule_event(time() + 60, 'bds_five_minutes', 'bds_mail_tick'); }
});
add_action('bds_mail_tick', 'bds_process_mail');
add_action('bds_mail_soon', 'bds_process_mail');
function bds_operations_deactivate() {
    wp_clear_scheduled_hook('bds_mail_tick');
    wp_clear_scheduled_hook('bds_mail_soon');
}
function bds_enquiry_statuses() {
    return array('new' => 'New', 'in_progress' => 'In progress', 'waiting' => 'Waiting for customer', 'closed' => 'Closed', 'archived' => 'Archived');
}
function bds_save_enquiry_workflow($id, $status, $notes, $expected_updated_at) {
    global $wpdb;
    if (!current_user_can('manage_options')) { return new WP_Error('bds_forbidden', 'Owner access required.'); }
    if (!isset(bds_enquiry_statuses()[$status])) { return new WP_Error('bds_status', 'Invalid enquiry status.'); }
    if (strlen($notes) > 10000) { return new WP_Error('bds_notes', 'Keep internal notes below 10,000 bytes.'); }
    $row = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_enquiries WHERE id = %s", $id), ARRAY_A);
    if (!$row) { return new WP_Error('bds_missing', 'Enquiry not found.'); }
    if ((string) ($row['updated_at'] ?? '') !== $expected_updated_at) { return new WP_Error('bds_conflict', 'Another administrator updated this enquiry. Reload before saving.'); }
    $notes = sanitize_textarea_field($notes);
    if ($row['status'] === $status && ($row['notes'] ?? '') === $notes) { return true; }
    // Monotonic timestamp also detects two saves within one second.
    $updated = gmdate('Y-m-d H:i:s', max(time(), strtotime(($row['updated_at'] ?: '1970-01-01 00:00:00') . ' UTC') + 1));
    $saved = $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}bds_enquiries SET status = %s, notes = %s, updated_at = %s WHERE id = %s AND COALESCE(updated_at, '') = %s",
        $status, $notes, $updated, $id, $expected_updated_at));
    if ($saved !== 1) { return new WP_Error('bds_conflict', 'The enquiry could not be saved. Reload and try again.'); }
    bds_audit($id, 'enquiry_status_' . $status);
    return true;
}
function bds_enquiries_page() {
    if (!current_user_can('manage_options')) { return; }
    global $wpdb;
    echo '<div class="wrap"><h1>Enquiries</h1><p>Manage enquiries and follow-ups. Internal notes stay private. Archive hides a record from the default view; it can be restored using its status.</p>';
    if (isset($_POST['bds_workflow_save'])) {
        check_admin_referer('bds_workflow_save');
        $result = bds_save_enquiry_workflow(sanitize_text_field(wp_unslash($_POST['record_id'] ?? '')),
            sanitize_key(wp_unslash($_POST['status'] ?? '')), wp_unslash($_POST['notes'] ?? ''),
            sanitize_text_field(wp_unslash($_POST['expected_updated_at'] ?? '')));
        echo '<div class="notice ' . (is_wp_error($result) ? 'notice-error' : 'notice-success') . '"><p>' . esc_html(is_wp_error($result) ? $result->get_error_message() : 'Enquiry saved.') . '</p></div>';
    }
    $search = sanitize_text_field(wp_unslash($_GET['s'] ?? ''));
    $filter = sanitize_key(wp_unslash($_GET['status'] ?? 'active'));
    $page = max(1, absint($_GET['paged'] ?? 1));
    $where = '1=1'; $args = array();
    if (isset(bds_enquiry_statuses()[$filter])) { $where .= ' AND status = %s'; $args[] = $filter; }
    elseif ($filter !== 'all') { $where .= " AND status <> 'archived'"; }
    if ($search !== '') { $where .= ' AND (data LIKE %s OR notes LIKE %s)'; $like = '%' . $wpdb->esc_like($search) . '%'; $args[] = $like; $args[] = $like; }
    $count_sql = "SELECT COUNT(*) FROM {$wpdb->prefix}bds_enquiries WHERE $where";
    $total = (int) $wpdb->get_var($args ? $wpdb->prepare($count_sql, $args) : $count_sql);
    $page = min($page, max(1, (int) ceil($total / 25)));
    $query = "SELECT * FROM {$wpdb->prefix}bds_enquiries WHERE $where ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d";
    $rows = $wpdb->get_results($wpdb->prepare($query, array_merge($args, array(25, ($page - 1) * 25))), ARRAY_A);
    echo '<form method="get"><input type="hidden" name="page" value="bds-submissions"><label>Search <input type="search" name="s" value="' . esc_attr($search) . '"></label> <label>Status <select name="status">';
    foreach (array_merge(array('active' => 'All active', 'all' => 'All including archived'), bds_enquiry_statuses()) as $key => $label) {
        echo '<option value="' . esc_attr($key) . '" ' . selected($filter, $key, false) . '>' . esc_html($label) . '</option>';
    }
    echo '</select></label> <button class="button">Filter</button></form><p>' . esc_html($total) . ' matching enquiries</p>';
    foreach ($rows as $row) {
        $item = json_decode($row['data'], true) ?: array();
        echo '<details style="background:white;padding:15px;margin:10px 0"><summary><strong>' . esc_html(($item['type'] ?? 'Form') . ' — ' . ($item['name'] ?? '')) . '</strong> · ' . esc_html(bds_enquiry_statuses()[$row['status']] ?? $row['status']) . ' · ' . esc_html($row['created_at']) . ' UTC</summary><table class="widefat">';
        foreach ($item as $key => $value) { if (is_scalar($value)) { echo '<tr><th>' . esc_html($key) . '</th><td>' . esc_html($value) . '</td></tr>'; } }
        echo '</table>';
        if (!empty($item['file_id'])) {
            echo '<p><a href="' . esc_url(add_query_arg('_wpnonce', wp_create_nonce('wp_rest'), rest_url('bds/v1/files/' . $item['file_id']))) . '">Download private attachment</a></p>';
        }
        echo '<form method="post">'; wp_nonce_field('bds_workflow_save');
        echo '<input type="hidden" name="record_id" value="' . esc_attr($row['id']) . '"><input type="hidden" name="expected_updated_at" value="' . esc_attr($row['updated_at'] ?? '') . '"><p><label>Status <select name="status">';
        foreach (bds_enquiry_statuses() as $key => $label) { echo '<option value="' . esc_attr($key) . '" ' . selected($row['status'], $key, false) . '>' . esc_html($label) . '</option>'; }
        echo '</select></label></p><p><label>Private follow-up notes<textarea name="notes" rows="4" class="large-text" maxlength="10000">' . esc_textarea($row['notes'] ?? '') . '</textarea></label></p><button class="button button-primary" name="bds_workflow_save" value="1">Save enquiry</button></form></details>';
    }
    for ($i = max(1, $page - 3); $i <= min((int) ceil($total / 25), $page + 3); $i++) {
        echo '<a class="button" ' . ($i === $page ? 'aria-current="page" ' : '') . 'href="' . esc_url(add_query_arg(array('page' => 'bds-submissions', 's' => $search, 'status' => $filter, 'paged' => $i), admin_url('admin.php'))) . '">' . esc_html($i) . '</a> ';
    }
    echo '</div>';
}
function bds_retry_mail($id) {
    global $wpdb;
    if (!current_user_can('manage_options')) { return false; }
    $saved = $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}bds_mail_queue SET status = 'queued', attempts = 0, available_at = %s, updated_at = %s WHERE id = %s AND status = 'failed' AND payload <> ''", gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'), $id));
    if ($saved === 1) { bds_audit($id, 'mail_retry'); return true; }
    return false;
}
add_action('admin_menu', function () {
    add_submenu_page('bds-marvel', 'Operations', 'Operations', 'manage_options', 'bds-operations', 'bds_operations_page');
});
function bds_operations_page() {
    if (!current_user_can('manage_options')) { return; }
    global $wpdb;
    echo '<div class="wrap"><h1>Backend operations</h1>';
    if (isset($_POST['bds_retry_mail'])) {
        check_admin_referer('bds_retry_mail');
        $retried = bds_retry_mail(sanitize_text_field(wp_unslash($_POST['bds_retry_mail'])));
        echo '<div class="notice ' . ($retried ? 'notice-success' : 'notice-error') . '"><p>' . ($retried ? 'Message queued for retry.' : 'Message was not retried. Reload to see its current status.') . '</p></div>';
    }
    $last = (int) get_option('bds_mail_last_run', 0);
    echo '<p>Last email worker run: ' . esc_html($last ? gmdate('Y-m-d H:i:s', $last) . ' UTC' : 'Not yet run') . '</p>';
    if (!$last || $last < time() - 15 * MINUTE_IN_SECONDS) { echo '<div class="notice notice-warning"><p>Email worker has not run recently. Check WordPress cron. Low traffic sites need a host scheduler.</p></div>'; }
    echo '<p>Mail retries up to five times. “Sent” means the WordPress mail transport accepted the message; it does not confirm inbox delivery. Configure SMTP and verify real delivery before taking bookings.</p><ul>';
    foreach ($wpdb->get_results("SELECT status, COUNT(*) AS total FROM {$wpdb->prefix}bds_mail_queue GROUP BY status", ARRAY_A) as $row) { echo '<li>' . esc_html(ucfirst($row['status']) . ': ' . $row['total']) . '</li>'; }
    echo '</ul><h2>Failed messages</h2><p>Retrying can send a duplicate if the transport accepted a previous attempt before the worker stopped.</p>';
    foreach ($wpdb->get_results("SELECT id,record_id,attempts,updated_at FROM {$wpdb->prefix}bds_mail_queue WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 50", ARRAY_A) as $row) {
        echo '<form method="post"><p>Record ' . esc_html($row['record_id']) . ' · ' . esc_html($row['attempts']) . ' attempts · ' . esc_html($row['updated_at']) . ' UTC '; wp_nonce_field('bds_retry_mail');
        echo '<button class="button" name="bds_retry_mail" value="' . esc_attr($row['id']) . '">Retry message</button></p></form>';
    }
    echo '<h2>Recent activity</h2><table class="widefat striped"><thead><tr><th>Time (UTC)</th><th>User ID</th><th>Record</th><th>Action</th></tr></thead><tbody>';
    foreach ($wpdb->get_results("SELECT * FROM {$wpdb->prefix}bds_audit ORDER BY id DESC LIMIT 100", ARRAY_A) as $row) { echo '<tr><td>' . esc_html($row['created_at']) . '</td><td>' . esc_html($row['user_id']) . '</td><td>' . esc_html($row['record_id']) . '</td><td>' . esc_html($row['action']) . '</td></tr>'; }
    echo '</tbody></table></div>';
}
