<?php
if (!defined('ABSPATH')) { exit; }
function bds_security_install() {
    global $wpdb;
    $charset = $wpdb->get_charset_collate();
    dbDelta("CREATE TABLE {$wpdb->prefix}bds_rate_limits (
        id varchar(64) NOT NULL,
        attempts int unsigned NOT NULL DEFAULT 0,
        expires_at bigint unsigned NOT NULL,
        PRIMARY KEY  (id),
        KEY expiry (expires_at)
    ) $charset;");
}
add_action('bds_mail_tick', function () {
    global $wpdb;
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->prefix}bds_rate_limits WHERE expires_at < %d", time()));
});
function bds_upload_token($create = false) {
    $token = $_COOKIE['bds_upload_token'] ?? '';
    if (is_string($token) && preg_match('/^[a-f0-9]{64}$/', $token)) { return $token; }
    if (!$create) { return ''; }
    $token = bin2hex(random_bytes(32));
    setcookie('bds_upload_token', $token, array('expires' => time() + DAY_IN_SECONDS, 'path' => '/', 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax'));
    $_COOKIE['bds_upload_token'] = $token;
    return $token;
}
function bds_validate_attachment($data) {
    if (empty($data['file_id'])) { return true; }
    if (!preg_match('/^[a-f0-9-]{36}$/', $data['file_id'])) { return false; }
    $token = bds_upload_token();
    if (!$token) { return false; }
    $posts = get_posts(array('post_type' => 'bds_upload', 'post_status' => 'private', 'name' => $data['file_id'], 'numberposts' => 1));
    if (!$posts) { return false; }
    $owner = get_post_meta($posts[0]->ID, '_bds_upload_owner', true);
    return is_string($owner) && $owner !== '' && hash_equals($owner, hash('sha256', $token));
}
