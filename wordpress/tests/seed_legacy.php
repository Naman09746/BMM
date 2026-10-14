<?php
if (getenv('BDS_DISPOSABLE_TEST_SITE') !== '1') { throw new Exception('Disposable test site only'); }
global $wpdb;
$wpdb->query("CREATE TABLE {$wpdb->prefix}bds_enquiries (id varchar(36) NOT NULL PRIMARY KEY, type varchar(40) NOT NULL, created_at datetime NOT NULL, data longtext NOT NULL)");
$wpdb->insert($wpdb->prefix . 'bds_enquiries', array('id' => 'legacy-enquiry', 'type' => 'Contact', 'created_at' => '2026-01-01 00:00:00', 'data' => '{"name":"Legacy","email":"legacy@example.test"}'));
update_option('bds_db_version', '2.0.0');
