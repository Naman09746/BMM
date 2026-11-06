<?php
if (!defined('ABSPATH')) { exit; }
function bds_can_manage_enquiries() { return current_user_can('manage_options') || current_user_can('bds_manage_enquiries'); }
function bds_enquiry_assignee_allowed($id) { return user_can($id, 'manage_options') || user_can($id, 'bds_manage_enquiries'); }
add_action('init', function () {
    $admin = get_role('administrator');
    if ($admin && !$admin->has_cap('bds_manage_enquiries')) { $admin->add_cap('bds_manage_enquiries'); }
    // Available for explicit assignment by a site administrator; no existing user is changed.
    if (!get_role('bds_enquiry_manager')) { add_role('bds_enquiry_manager', 'BDS enquiry manager', array('read' => true, 'bds_manage_enquiries' => true)); }
}, 5);
function bds_enquiry_assignment_fields($row) {
    $users = get_users(array('capability__in' => array('manage_options','bds_manage_enquiries'), 'fields' => array('ID','display_name'), 'number' => 100));
    echo '<p><label>Assigned to <select name="assigned_user_id"><option value="0">Unassigned</option>';
    foreach ($users as $user) { echo '<option value="' . esc_attr($user->ID) . '" ' . selected((int) ($row['assigned_user_id'] ?? 0), $user->ID, false) . '>' . esc_html($user->display_name) . '</option>'; }
    echo '</select></label> <label>Follow-up date <input type="date" name="follow_up_date" value="' . esc_attr($row['follow_up_date'] ?? '') . '"></label></p>';
}
add_action('admin_menu', function () {
    add_submenu_page('bds-marvel', 'Customer history', 'Customer history', 'bds_manage_enquiries', 'bds-customers', 'bds_customers_page');
});
function bds_customer_history($email) {
    global $wpdb;
    if (!bds_can_manage_enquiries() || !is_email($email)) { return array(); }
    $result = array();
    $like = '%' . $wpdb->esc_like($email) . '%';
    // Match the decoded email exactly after narrowing candidates; do not merge accounts by names.
    $sources = current_user_can('manage_options') ? array('enquiries','bookings') : array('enquiries');
    foreach ($sources as $source) {
        $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bds_$source WHERE data LIKE %s ORDER BY created_at DESC LIMIT 200", $like), ARRAY_A);
        foreach ($rows as $row) {
            $data = json_decode($row['data'], true);
            if (!is_array($data) || strcasecmp($data['email'] ?? '', $email) !== 0) { continue; }
            $result[] = array('id' => $row['id'], 'created_at' => $row['created_at'], 'type' => $source === 'bookings' ? 'Booking' : ($data['type'] ?? 'Enquiry'),
                'status' => $row['status'], 'summary' => $source === 'bookings' ? ($data['reference'] ?? '') : ($data['message'] ?? $data['requirements'] ?? ''),
                'name' => $data['name'] ?? '', 'follow_up_date' => $row['follow_up_date'] ?? '');
        }
    }
    usort($result, function ($a, $b) { return strcmp($b['created_at'], $a['created_at']); });
    return $result;
}
function bds_customers_page() {
    if (!bds_can_manage_enquiries()) { return; }
    $email = '';
    if (isset($_POST['bds_customer_search'])) { check_admin_referer('bds_customer_search'); $email = sanitize_email(wp_unslash($_POST['email'] ?? '')); }
    echo '<div class="wrap"><h1>Customer history</h1><p>Look up a customer by email. Administrators see enquiries and bookings; enquiry managers see enquiries only. Results cover up to 200 matching candidates per source.</p><form method="post">';
    wp_nonce_field('bds_customer_search');
    echo '<label>Email <input type="email" name="email" required value="' . esc_attr($email) . '"></label> <button class="button" name="bds_customer_search" value="1">Find history</button></form>';
    if ($email) {
        $rows = bds_customer_history($email);
        echo '<table class="widefat striped"><thead><tr><th>Created (UTC)</th><th>Type</th><th>Name</th><th>Status</th><th>Summary</th><th>Follow-up</th></tr></thead><tbody>';
        foreach ($rows as $row) { echo '<tr><td>' . esc_html($row['created_at']) . '</td><td>' . esc_html($row['type']) . '</td><td>' . esc_html($row['name']) . '</td><td>' . esc_html($row['status']) . '</td><td>' . esc_html($row['summary']) . '</td><td>' . esc_html($row['follow_up_date']) . '</td></tr>'; }
        echo '</tbody></table>'; if (!$rows) { echo '<p>No matching history found.</p>'; }
    }
    echo '</div>';
}
