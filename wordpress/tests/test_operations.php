<?php
// Offline behavior tests: actual SQLite statements with minimal WordPress shims.
// Run: php wordpress/tests/test_operations.php. No network or email is sent.
define('ABSPATH', __DIR__ . '/'); define('ARRAY_A', 'ARRAY_A');
define('MINUTE_IN_SECONDS', 60); define('HOUR_IN_SECONDS', 3600); define('DAY_IN_SECONDS', 86400);
$allowed = true; $mail_ok = true; $mail_calls = 0; $options = array(); $events = array(); $schemas = array();
function absint($value) { return abs((int) $value); }
function user_can($user, $cap) { return false; }
function add_action(...$args) {} function add_filter(...$args) {}
function dbDelta($sql) { global $schemas; $schemas[] = $sql; }
function current_user_can($cap) { global $allowed; return $allowed; }
function get_transient($key) { return false; }
function is_user_logged_in() { return true; }
function wp_get_current_user() { return (object) array('ID' => 7); }
function is_email($email) { return filter_var($email, FILTER_VALIDATE_EMAIL); }
function wp_json_encode($value) { return json_encode($value); }
function wp_generate_uuid4() { return sprintf('%08x-0000-4000-8000-%012x', random_int(1, 99999999), random_int(1, 99999999)); }
function wp_next_scheduled($hook) { global $events; return $events[$hook] ?? false; }
function wp_schedule_single_event($time, $hook) { global $events; $events[$hook] = $time; }
function wp_clear_scheduled_hook($hook) { global $events; unset($events[$hook]); }
function get_option($key, $default = false) { global $options; return $options[$key] ?? $default; }
function home_url($path = '') { return 'https://example.test' . $path; }
function sanitize_email($value) { return filter_var($value, FILTER_SANITIZE_EMAIL); }
function bds_form_config($slug) { return null; }
function update_option($key, $value, $autoload = null) { global $options; $options[$key] = $value; }
function sanitize_textarea_field($value) { return strip_tags($value); }
function wp_mail(...$args) { global $mail_ok, $mail_calls; $mail_calls++; if ($mail_ok === 'throw') { throw new Exception('transport stopped'); } return $mail_ok; }
class WP_Error { public $message; function __construct($code, $message) { $this->message = $message; } }
function is_wp_error($value) { return $value instanceof WP_Error; }
class TestDB {
    public $prefix = 'wp_'; public $db; public $steal_claim = false; public $fail_mail_insert_after = 0;
    function __construct() {
        $this->db = new PDO('sqlite::memory:'); $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->db->exec("CREATE TABLE wp_bds_mail_queue (id TEXT PRIMARY KEY, record_id TEXT, status TEXT, attempts INTEGER, available_at TEXT, updated_at TEXT, created_at TEXT, payload TEXT);
          CREATE TABLE wp_bds_bookings (id TEXT PRIMARY KEY, user_id INTEGER, stay_slug TEXT, status TEXT, check_in TEXT, check_out TEXT, created_at TEXT, data TEXT, payment_order_id TEXT);
          CREATE TABLE wp_bds_enquiries (id TEXT PRIMARY KEY, type TEXT, created_at TEXT, data TEXT, status TEXT DEFAULT 'new', notes TEXT, updated_at TEXT, assigned_user_id INTEGER DEFAULT 0, follow_up_date TEXT);
          CREATE TABLE wp_bds_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, record_id TEXT, action TEXT, created_at TEXT);");
    }
    function get_charset_collate() { return ''; }
    function prepare($sql, ...$args) {
        if (count($args) === 1 && is_array($args[0])) { $args = $args[0]; }
        $i = 0;
        return preg_replace_callback('/%[sd]/', function ($m) use ($args, &$i) { $v = $args[$i++]; return $m[0] === '%d' ? (string) (int) $v : $this->db->quote((string) $v); }, $sql);
    }
    function query($sql) {
        $sql = str_replace('START TRANSACTION', 'BEGIN TRANSACTION', $sql);
        if ($this->steal_claim && strpos($sql, "SET status = 'sending'") !== false) { $this->steal_claim = false; return 0; }
        $sql = str_replace("IF(attempts >= 5, 'failed', 'queued')", "CASE WHEN attempts >= 5 THEN 'failed' ELSE 'queued' END", $sql);
        return $this->db->exec($sql);
    }
    function insert($table, $data) {
        if ($table === 'wp_bds_mail_queue' && $this->fail_mail_insert_after > 0 && --$this->fail_mail_insert_after === 0) { return false; }
        $q = $this->db->prepare('INSERT INTO ' . $table . ' (' . implode(',', array_keys($data)) . ') VALUES (' . implode(',', array_fill(0, count($data), '?')) . ')');
        return $q->execute(array_values($data)) ? 1 : false;
    }
    function update($table, $data, $where) {
        $q = $this->db->prepare('UPDATE ' . $table . ' SET ' . implode(',', array_map(function ($k) { return "$k = ?"; }, array_keys($data))) . ' WHERE ' . implode(' AND ', array_map(function ($k) { return "$k = ?"; }, array_keys($where))));
        $q->execute(array_merge(array_values($data), array_values($where))); return $q->rowCount();
    }
    function get_results($sql, $mode = null) { return $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC); }
    function get_row($sql, $mode = null) { return $this->db->query($sql)->fetch(PDO::FETCH_ASSOC) ?: null; }
    function get_var($sql) { return $this->db->query($sql)->fetchColumn(); }
}
$wpdb = new TestDB();
class WP_REST_Response { public $data; public $status; function __construct($data, $status = 200) { $this->data = $data; $this->status = $status; } }
require __DIR__ . '/../bds-marvel-app/includes/api.php';
require __DIR__ . '/../bds-marvel-app/includes/operations.php';
require __DIR__ . '/../bds-marvel-app/includes/customers.php';
$n = 0;
function check($name, $condition) { global $n; if (!$condition) { throw new Exception($name); } $n++; echo "PASS $name\n"; }
function mail_row() { global $wpdb; return $wpdb->get_row('SELECT * FROM wp_bds_mail_queue LIMIT 1'); }
function clear_mail() { global $wpdb; $wpdb->query('DELETE FROM wp_bds_mail_queue'); }
function queue_test() { return bds_queue_mail('guest@example.test', 'Test', 'Private message', array(), 'enquiry-1'); }
bds_operations_install();
check('Migration adds workflow and outbox', count($schemas) === 3 && strpos($schemas[0], "DEFAULT 'new'") !== false && strpos($schemas[0], 'notes text DEFAULT NULL') !== false);
check('Invalid recipient rejected', bds_queue_mail('invalid', 'Test', 'Message') === false && mail_row() === null);
check('Mail persisted before transport', queue_test() && mail_row()['status'] === 'queued' && $mail_calls === 0);
check('Immediate cron scheduled', isset($events['bds_mail_soon']));
bds_process_mail(); check('Transport success saved', mail_row()['status'] === 'sent' && mail_row()['attempts'] == 1);
bds_process_mail(); check('Sent message not sent again', $mail_calls === 1);
clear_mail(); queue_test(); $mail_ok = false;
bds_process_mail(); $r = mail_row();
check('Transport failure remains queued', $r['status'] === 'queued' && $r['attempts'] == 1 && strtotime($r['available_at'] . ' UTC') > time());
$before = $mail_calls; bds_process_mail(); check('Future retry not sent early', $before === $mail_calls);
for ($i = 2; $i <= 5; $i++) { $wpdb->query("UPDATE wp_bds_mail_queue SET available_at = '2000-01-01 00:00:00'"); bds_process_mail(); }
check('Stops after five attempts', mail_row()['status'] === 'failed' && mail_row()['attempts'] == 5);
$id = mail_row()['id']; $allowed = false;
check('Guest cannot retry mail', bds_retry_mail($id) === false); $allowed = true;
check('Owner retry resets failure', bds_retry_mail($id) && mail_row()['attempts'] == 0 && mail_row()['status'] === 'queued');
check('Repeated retry does not reset queued work', bds_retry_mail($id) === false);
$mail_ok = 'throw'; bds_process_mail(); check('Transport exception retried', mail_row()['status'] === 'queued');
$wpdb->query("UPDATE wp_bds_mail_queue SET status = 'sending', updated_at = '2000-01-01 00:00:00', available_at = '2000-01-01 00:00:00'"); $mail_ok = true;
bds_process_mail(); check('Interrupted worker recovered', mail_row()['status'] === 'sent');
clear_mail(); queue_test(); $wpdb->steal_claim = true; $before = $mail_calls;
bds_process_mail(); check('Lost atomic claim does not send', $mail_calls === $before && mail_row()['status'] === 'queued');
bds_process_mail();
$wpdb->query("UPDATE wp_bds_mail_queue SET updated_at = '2000-01-01 00:00:00'"); bds_process_mail();
check('Old sent payload cleared', mail_row()['payload'] === '');
check('Backoff grows and is capped', bds_mail_retry_delay(1) === 60 && bds_mail_retry_delay(5) === 960 && bds_mail_retry_delay(20) === 21600);
$wpdb->insert('wp_bds_enquiries', array('id' => 'enquiry-1', 'type' => 'Contact', 'created_at' => '2026-01-01', 'data' => '{"name":"Guest"}'));
$allowed = false;
check('Guest cannot change enquiry', is_wp_error(bds_save_enquiry_workflow('enquiry-1', 'closed', 'private', ''))); $allowed = true;
check('Invalid status rejected', is_wp_error(bds_save_enquiry_workflow('enquiry-1', 'unknown', '', '')));
check('Oversized notes rejected', is_wp_error(bds_save_enquiry_workflow('enquiry-1', 'new', str_repeat('x', 10001), '')));
check('Owner can save private notes and status', bds_save_enquiry_workflow('enquiry-1', 'in_progress', '<b>Call tomorrow</b>', '') === true);
$r = $wpdb->get_row('SELECT * FROM wp_bds_enquiries');
check('Public payload unchanged by private notes', $r['data'] === '{"name":"Guest"}' && $r['notes'] === 'Call tomorrow');
check('Stale administrator save rejected', is_wp_error(bds_save_enquiry_workflow('enquiry-1', 'closed', 'Stale note', '')));
check('Archive remains recoverable', bds_save_enquiry_workflow('enquiry-1', 'archived', 'Call tomorrow', $r['updated_at']) === true);
$r2 = $wpdb->get_row('SELECT * FROM wp_bds_enquiries');
check('Version advances within one second', $r2['updated_at'] > $r['updated_at']);
check('Archived record restored', bds_save_enquiry_workflow('enquiry-1', 'new', 'Call tomorrow', $r2['updated_at']) === true);
check('Audit contains no private message text', strpos(json_encode($wpdb->get_results('SELECT * FROM wp_bds_audit')), 'Call tomorrow') === false);
class SessionRequest { function get_route() { return '/bds/v1/auth/session'; } function get_method() { return 'POST'; } function get_json_params() { return array('session_id' => 'untrusted'); } }
function wp_remote_get(...$args) { throw new Exception('Unexpected outbound identity lookup'); }
$response = bds_api(new SessionRequest());
check('Legacy identity route disabled before external lookup', $response->status === 410);
clear_mail(); $options['bds_notification_email'] = 'owner@example.test';
check('Booking notifications queue owner and guest independently', bds_notify(array('id' => 'booking-1', 'email' => 'guest@example.test'), 'Booking', true) === true && (int) $wpdb->get_var('SELECT COUNT(*) FROM wp_bds_mail_queue') === 2);
check('Queue retains related booking ID', (int) $wpdb->get_var("SELECT COUNT(*) FROM wp_bds_mail_queue WHERE record_id = 'booking-1'") === 2);
$bookingData = array('id' => 'booking-atomic', 'email' => 'guest@example.test', 'reference' => 'BDS-TEST');
$bookingRow = array('id' => 'booking-atomic', 'user_id' => 7, 'stay_slug' => 'living-studio', 'status' => 'requested',
    'check_in' => '2030-01-01', 'check_out' => '2030-01-02', 'created_at' => '2030-01-01 00:00:00', 'data' => wp_json_encode($bookingData));
clear_mail();
check('Booking and both notifications commit together', bds_save_booking_with_notifications($bookingData, $bookingRow, 'Booking') === true
    && (int) $wpdb->get_var('SELECT COUNT(*) FROM wp_bds_bookings') === 1
    && (int) $wpdb->get_var('SELECT COUNT(*) FROM wp_bds_mail_queue') === 2);
$wpdb->query('DELETE FROM wp_bds_bookings'); clear_mail(); $wpdb->fail_mail_insert_after = 2;
$notificationFailure = bds_save_booking_with_notifications($bookingData, $bookingRow, 'Booking');
$wpdb->fail_mail_insert_after = 0;
check('Booking rolls back if either notification cannot be queued', $notificationFailure instanceof WP_REST_Response
    && $notificationFailure->status === 503
    && (int) $wpdb->get_var('SELECT COUNT(*) FROM wp_bds_bookings') === 0
    && (int) $wpdb->get_var('SELECT COUNT(*) FROM wp_bds_mail_queue') === 0);
bds_operations_deactivate(); check('Deactivation removes scheduled events', empty($events));
echo "TOTAL $n\n";
