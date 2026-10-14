<?php
// Run only with wp eval-file on the disposable CI WordPress/MySQL installation.
if (getenv('BDS_DISPOSABLE_TEST_SITE') !== '1') { throw new Exception('Disposable test site only'); }
global $wpdb, $checks;
$checks = 0;
function verify_bds($name, $ok) { global $checks; if (!$ok) { throw new Exception($name); } $checks++; echo "PASS $name\n"; }
wp_set_current_user(1);
add_filter('pre_wp_mail', '__return_true');
foreach (array('bookings','enquiries','mail_queue','audit','rate_limits','payment_events') as $name) {
    verify_bds('Real MySQL schema ' . $name, $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->prefix . 'bds_' . $name)) !== null);
}
$legacy = $wpdb->get_row("SELECT * FROM {$wpdb->prefix}bds_enquiries WHERE id = 'legacy-enquiry'", ARRAY_A);
verify_bds('Legacy enquiry preserved and defaulted to New', $legacy && $legacy['status'] === 'new' && json_decode($legacy['data'], true)['name'] === 'Legacy');
bds_install();
verify_bds('Repeated migration preserves legacy record', (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bds_enquiries WHERE id = 'legacy-enquiry'") === 1);
verify_bds('Atomic limiter allows first attempt', bds_limit('ci-test', 2, 'ci-identity'));
verify_bds('Atomic limiter allows second attempt', bds_limit('ci-test', 2, 'ci-identity'));
verify_bds('Atomic limiter rejects excess', !bds_limit('ci-test', 2, 'ci-identity'));
verify_bds('Separate identity has separate limit', bds_limit('ci-test', 2, 'ci-other'));
verify_bds('Private workflow saves on MySQL', bds_save_enquiry_workflow('legacy-enquiry','in_progress','Call customer','',1,'2027-01-20') === true);
$updated = $wpdb->get_row("SELECT * FROM {$wpdb->prefix}bds_enquiries WHERE id = 'legacy-enquiry'", ARRAY_A);
verify_bds('Assignment and follow-up persisted', (int) $updated['assigned_user_id'] === 1 && $updated['follow_up_date'] === '2027-01-20');
verify_bds('Stale edits rejected on MySQL', is_wp_error(bds_save_enquiry_workflow('legacy-enquiry','closed','Stale','')));
verify_bds('Invalid follow-up date rejected', is_wp_error(bds_save_enquiry_workflow('legacy-enquiry','closed','', $updated['updated_at'],0,'2027-02-30')));
$guest_id = wp_insert_user(array('user_login'=>'ci_guest','user_email'=>'guest@example.test','user_pass'=>'disposable-test-password','role'=>'subscriber'));
$staff_id = wp_insert_user(array('user_login'=>'ci_staff','user_email'=>'staff@example.test','user_pass'=>'disposable-test-password','role'=>'bds_enquiry_manager'));
wp_set_current_user($guest_id);
verify_bds('Subscriber cannot edit enquiry', is_wp_error(bds_save_enquiry_workflow('legacy-enquiry','closed','', $updated['updated_at'])));
verify_bds('Subscriber sees no customer history', bds_customer_history('legacy@example.test') === array());
wp_set_current_user($staff_id);
verify_bds('Enquiry manager has limited capability', bds_can_manage_enquiries() && !current_user_can('manage_options') && !current_user_can('edit_posts'));
verify_bds('Enquiry manager cannot retry email', !bds_retry_mail('not-a-message'));
wp_set_current_user(1);
verify_bds('Outbox accepts message', bds_queue_mail('guest@example.test','CI mail','Test only',array(),'legacy-enquiry'));
bds_process_mail();
verify_bds('Outbox sent state persisted in MySQL', (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bds_mail_queue WHERE status = 'sent'") === 1);
// Create real booking rows and exercise payment races and signed callbacks without external requests.
function ci_booking($status = 'payment_pending', $mode = 'instant', $slug = 'ci-stay') {
    global $wpdb;
    $id = wp_generate_uuid4();
    $data = array('id'=>$id,'reference'=>'CI-'.$id,'user_id'=>'1','email'=>'guest@example.test','stay_slug'=>$slug,'stay'=>'CI stay','status'=>$status,'mode'=>$mode,
        'total'=>1000,'payment_provider'=>'razorpay','razorpay_order_id'=>'order_'.str_replace('-','',$id),'payment_status'=>'pending');
    $wpdb->insert($wpdb->prefix.'bds_bookings',array('id'=>$id,'user_id'=>1,'stay_slug'=>$slug,'status'=>$status,'check_in'=>'2035-01-01','check_out'=>'2035-01-04','created_at'=>gmdate('Y-m-d H:i:s'),'data'=>wp_json_encode($data),'payment_order_id'=>$data['razorpay_order_id']));
    return $data;
}
function ci_payment($booking) { return array('id'=>'pay_'.str_replace('-','',$booking['id']),'order_id'=>$booking['razorpay_order_id'],'amount'=>100000,'currency'=>'INR','status'=>'captured','amount_refunded'=>0); }
$b = ci_booking(); $payment = ci_payment($b);
verify_bds('Wrong captured amount rejected', bds_apply_captured_payment($b['id'],array_merge($payment,array('amount'=>1)))->get_status() === 400);
$data = bds_apply_captured_payment($b['id'],$payment);
verify_bds('Captured payment confirms instant booking', is_array($data) && $data['status']==='confirmed' && $data['payment_status']==='paid');
$messages = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bds_mail_queue");
verify_bds('Duplicate capture preserves state', bds_apply_captured_payment($b['id'],$payment)['status']==='confirmed');
verify_bds('Duplicate capture does not enqueue duplicate notices', (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bds_mail_queue") === $messages);
$cancelled = ci_booking('cancelled','instant','ci-cancelled');
$data = bds_apply_captured_payment($cancelled['id'],ci_payment($cancelled));
verify_bds('Late payment never reopens cancellation', $data['status']==='cancelled' && !empty($data['refund_attention']));
$conflict = ci_booking('payment_pending','instant','ci-stay');
$data = bds_apply_captured_payment($conflict['id'],ci_payment($conflict));
verify_bds('Overlapping paid booking flagged for refund', $data['status']==='payment_conflict' && $data['payment_status']==='paid_conflict');
update_option('bds_razorpay_key_id','rzp_test_ci');
update_option('bds_razorpay_key_secret','ci-key-secret');
$verify_request = new WP_REST_Request('POST','/bds/v1/stays/payments/verify');
$verify_request->set_header('Content-Type','application/json');
$verify_request->set_body(wp_json_encode(array('booking_id'=>$conflict['id'],'razorpay_order_id'=>$conflict['razorpay_order_id'],
    'razorpay_payment_id'=>ci_payment($conflict)['id'],'razorpay_signature'=>hash_hmac('sha256',$conflict['razorpay_order_id'].'|'.ci_payment($conflict)['id'],'ci-key-secret'))));
verify_bds('Checkout retry reports paid date conflict', bds_verify_stay_payment($verify_request)->get_status()===409);
$verify_request->set_body(wp_json_encode(array('booking_id'=>$cancelled['id'],'razorpay_order_id'=>$cancelled['razorpay_order_id'],
    'razorpay_payment_id'=>ci_payment($cancelled)['id'],'razorpay_signature'=>hash_hmac('sha256',$cancelled['razorpay_order_id'].'|'.ci_payment($cancelled)['id'],'ci-key-secret'))));
verify_bds('Checkout retry never reports cancelled stay as reserved', bds_verify_stay_payment($verify_request)->get_status()===409);
// Keep the following HTTP suite on the unpaid-request path.
delete_option('bds_razorpay_key_id'); delete_option('bds_razorpay_key_secret');
$refund = array_merge($payment,array('amount_refunded'=>50000));
verify_bds('Partial refund tracked', bds_apply_refund_state($b['id'],$refund)['payment_status']==='partially_refunded');
$refund['amount_refunded']=100000;
verify_bds('Full refund cancels booking', bds_apply_refund_state($b['id'],$refund)['status']==='cancelled');
verify_bds('Stale refund failure cannot regress full refund', bds_apply_refund_state($b['id'],$payment,true)['payment_status']==='refunded');
verify_bds('Late duplicate capture cannot regress refund', bds_apply_captured_payment($b['id'],$payment)['payment_status']==='refunded');
update_option('bds_razorpay_webhook_secret','ci-webhook-secret');
$webhook_booking=ci_booking('payment_pending','request','ci-webhook');
$body=wp_json_encode(array('event'=>'payment.captured','payload'=>array('payment'=>array('entity'=>ci_payment($webhook_booking)))));
$request=new WP_REST_Request('POST','/bds/v1/payments/razorpay/webhook');
$request->set_body($body); $request->set_header('X-Razorpay-Event-Id','ci-event-1');
$request->set_header('X-Razorpay-Signature',hash_hmac('sha256',$body,'ci-webhook-secret'));
verify_bds('Signed webhook accepts raw-body signature', bds_payment_webhook($request)['received']===true);
verify_bds('Repeated webhook identified', bds_payment_webhook($request)['duplicate']===true);
$request->set_body($body.' ');
verify_bds('Tampered body rejected', is_wp_error(bds_payment_webhook($request)));
$request->set_header('X-Razorpay-Signature',hash_hmac('sha256',$body.' ','ci-webhook-secret'));
verify_bds('Reused event ID with changed signed body rejected', bds_payment_webhook($request)->get_status()===409);
$history=bds_customer_history('guest@example.test');
verify_bds('Administrator sees booking history', count($history)>=4);
wp_set_current_user($staff_id);
verify_bds('Staff customer history hides bookings', bds_customer_history('guest@example.test')===array());
wp_set_current_user(1);
$_COOKIE['bds_upload_token']=str_repeat('a',64);
$file_id=wp_generate_uuid4();
$post=wp_insert_post(array('post_type'=>'bds_upload','post_status'=>'private','post_name'=>$file_id,'post_title'=>'CI attachment'));
update_post_meta($post,'_bds_upload_owner',hash('sha256',$_COOKIE['bds_upload_token']));
verify_bds('Attachment owner accepted', bds_validate_attachment(array('file_id'=>$file_id)));
$_COOKIE['bds_upload_token']=str_repeat('b',64);
verify_bds('Other browser cannot attach private file', !bds_validate_attachment(array('file_id'=>$file_id)));
// Rendering exercises real WordPress capabilities, escaping and query paths.
ob_start(); bds_enquiries_page(); $html=ob_get_clean();
verify_bds('Native enquiry management renders assignment fields', strpos($html,'follow_up_date')!==false && strpos($html,'Call customer')!==false);
ob_start(); bds_operations_page(); $html=ob_get_clean();
verify_bds('Operations renders payment reconciliation', strpos($html,'Reconcile payment')!==false);
echo "TOTAL WORDPRESS $checks\n";
