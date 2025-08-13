<?php

if (!defined('ABSPATH')) {
    exit;
}

class TrustHive_Reviews_REST
{
    public function init()
    {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes()
    {
        register_rest_route('trusthive/v1', '/review', [
            'methods'  => ['GET', 'POST'],
            'callback' => [$this, 'handle_review'],
            'permission_callback' => function () {
                return wp_verify_nonce(
                    isset($_SERVER['HTTP_X_WP_NONCE']) ? $_SERVER['HTTP_X_WP_NONCE'] : '',
                    'wp_rest'
                );
            },
            'args' => [
                'product_id' => [ 'type' => 'integer', 'required' => true ],
                'author_name' => [ 'type' => 'string', 'required' => false ],
                'author_email' => [ 'type' => 'string', 'required' => false ],
                'rating' => [ 'type' => 'integer', 'required' => false ],
                'title' => [ 'type' => 'string', 'required' => false ],
                'content' => [ 'type' => 'string', 'required' => false ],
            ],
        ]);

        // Admin endpoints used by external dashboard (SSO via HMAC token)
        register_rest_route('trusthive/v1', '/admin/reviews', [
            'methods' => 'GET',
            'callback' => [$this, 'admin_list_reviews'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('trusthive/v1', '/admin/reviews/(?P<id>\d+)/action', [
            'methods' => 'POST',
            'callback' => [$this, 'admin_review_action'],
            'permission_callback' => '__return_true',
            'args' => [ 'action' => [ 'required' => true, 'type' => 'string' ] ],
        ]);
    }

    public function handle_review(WP_REST_Request $request)
    {
        $method = $request->get_method();

        if ($method === 'GET') {
            return $this->get_reviews($request);
        } else {
            return $this->submit_review($request);
        }
    }

    private function get_reviews(WP_REST_Request $request)
    {
        try {
            $product_id = absint($request->get_param('product_id'));

            if (!$product_id) {
                return new WP_Error('missing_product_id', __('Product ID is required', 'trusthive-reviews'), ['status' => 400]);
            }

            // Get shop ID from settings
            $settings = get_option(TrustHive_Reviews_Admin::OPTION_NAME, []);
            $shop_id = isset($settings['shop_id']) ? $settings['shop_id'] : '';

            if (empty($shop_id)) {
                return new WP_Error('missing_config', __('Plugin not configured: set Shop ID.', 'trusthive-reviews'), ['status' => 400]);
            }

            // Get approved reviews for the product that belong to this shop
            $args = [
                'post_id' => $product_id,
                'type' => 'review',
                'status' => 'approve',
                'meta_query' => [
                    [
                        'key' => 'trusthive_shop_id',
                        'value' => $shop_id,
                        'compare' => '='
                    ],
                    [
                        'key' => 'trusthive_rating',
                        'compare' => 'EXISTS'
                    ]
                ],
                'orderby' => 'comment_date',
                'order' => 'DESC',
                'number' => 50, // Limit to 50 reviews
            ];

            $comments = get_comments($args);
            $reviews = [];

            foreach ($comments as $comment) {
                $rating = get_comment_meta($comment->comment_ID, 'trusthive_rating', true);
                $title = get_comment_meta($comment->comment_ID, 'trusthive_title', true);

                $reviews[] = [
                    'id' => $comment->comment_ID,
                    'author_name' => $comment->comment_author,
                    'rating' => intval($rating),
                    'title' => $title,
                    'content' => $comment->comment_content,
                    'created_at' => $comment->comment_date_gmt,
                ];
            }

            return rest_ensure_response($reviews);

        } catch (Exception $e) {
            error_log('TrustHive get_reviews exception: ' . $e->getMessage() . " in " . $e->getFile() . ':' . $e->getLine());
            return new WP_Error('internal_error', __('Internal server error', 'trusthive-reviews'), ['status' => 500]);
        }
    }

    private function submit_review(WP_REST_Request $request)
    {
        try {
            // Validate nonce if present
            $nonce = isset($_SERVER['HTTP_X_WP_NONCE']) ? $_SERVER['HTTP_X_WP_NONCE'] : '';
            if ($nonce && !wp_verify_nonce($nonce, 'wp_rest')) {
                return new WP_Error('invalid_nonce', __('Invalid or missing nonce', 'trusthive-reviews'), ['status' => 403]);
            }

            $product_id   = absint($request->get_param('product_id'));
            $author_name  = sanitize_text_field($request->get_param('author_name'));
            $author_email = sanitize_email($request->get_param('author_email'));
            $rating       = absint($request->get_param('rating'));
            $title        = sanitize_text_field($request->get_param('title'));
            $content      = sanitize_textarea_field($request->get_param('content'));

            if ($rating < 1 || $rating > 5) {
                return new WP_Error('invalid_rating', __('Rating must be between 1 and 5', 'trusthive-reviews'), ['status' => 400]);
            }

            $settings = get_option(TrustHive_Reviews_Admin::OPTION_NAME, []);
            // Use the hardcoded TrustHive site URL and append the API path.
            $api_base = rtrim(defined('TRUSTHIVE_REVIEWS_SITE_URL') ? TRUSTHIVE_REVIEWS_SITE_URL : '', '/') . '/api';
            $shop_id  = isset($settings['shop_id']) ? $settings['shop_id'] : '';
            $api_key  = isset($settings['api_key']) ? $settings['api_key'] : '';

            if (empty($shop_id)) {
                return new WP_Error('missing_config', __('Plugin not configured: set Shop ID.', 'trusthive-reviews'), ['status' => 400]);
            }

            $payload = [
                'shop_id'    => $shop_id,
                'product_id' => $product_id,
                'author'     => [ 'name' => $author_name, 'email' => $author_email ],
                'rating'     => $rating,
                'title'      => $title,
                'content'    => $content,
                'source'     => get_bloginfo('name'),
                'site_url'   => site_url(),
            ];

            // Persist review into the local WordPress database as a product comment
            $comment_data = [
                'comment_post_ID'      => $product_id,
                'comment_author'       => $author_name,
                'comment_author_email' => $author_email,
                'comment_content'      => $content,
                'comment_type'         => 'review',
                'comment_approved'     => 0,
            ];

            // Try to insert the comment locally. If it fails, try once more using wp_slash
            // and record a transient so admins can debug later.
            $comment_id = wp_insert_comment($comment_data);
            if (!($comment_id && !is_wp_error($comment_id))) {
                // log and retry with slashed data
                error_log('TrustHive: wp_insert_comment initial attempt failed for product_id=' . intval($product_id));
                $slashed = wp_slash($comment_data);
                $comment_id = wp_insert_comment($slashed);
            }

            if ($comment_id && !is_wp_error($comment_id)) {
                add_comment_meta($comment_id, 'trusthive_shop_id', $shop_id, true);
                add_comment_meta($comment_id, 'trusthive_rating', $rating, true);
                if (!empty($title)) {
                    add_comment_meta($comment_id, 'trusthive_title', $title, true);
                }
                add_comment_meta($comment_id, 'trusthive_source', get_bloginfo('name'), true);
                add_comment_meta($comment_id, 'trusthive_site_url', site_url(), true);
            } else {
                $err_msg = 'Failed to save review locally for product_id=' . intval($product_id);
                error_log('TrustHive: ' . $err_msg);
                set_transient('trusthive_local_save_error', $err_msg, 60*60);
            }

            $args = [ 'headers' => [ 'Content-Type' => 'application/json' ], 'body' => wp_json_encode($payload), 'timeout' => 15 ];
            if (!empty($api_key)) {
                $args['headers']['Authorization'] = 'Bearer ' . $api_key;
            }

            $url = $api_base . '/reviews';
            $resp = wp_remote_post($url, $args);
            if (is_wp_error($resp)) {
                error_log('TrustHive remote error: ' . $resp->get_error_message());
                return new WP_Error('remote_error', $resp->get_error_message(), ['status' => 500]);
            }
            $code = wp_remote_retrieve_response_code($resp);
            $body = wp_remote_retrieve_body($resp);
            if ($code < 200 || $code >= 300) {
                error_log('TrustHive upstream error (' . $code . '): ' . $body);
                return new WP_Error('remote_error', sprintf(__('Upstream error (%d): %s', 'trusthive-reviews'), $code, $body), ['status' => 500]);
            }

            return new WP_REST_Response([ 'ok' => true ], 200);
        } catch (Exception $e) {
            error_log('TrustHive handle_review exception: ' . $e->getMessage() . " in " . $e->getFile() . ':' . $e->getLine());
            return new WP_Error('internal_error', __('Internal server error', 'trusthive-reviews'), ['status' => 500]);
        }
    }
    public function admin_list_reviews(WP_REST_Request $request)
    {
        $params = $request->get_query_params();
        $shop = isset($params['shop']) ? urldecode($params['shop']) : '';
        $ts = isset($params['ts']) ? $params['ts'] : '';
        $token = isset($params['token']) ? $params['token'] : '';

        $settings = get_option(TrustHive_Reviews_Admin::OPTION_NAME, []);
        $api_key = isset($settings['api_key']) ? $settings['api_key'] : '';

        // Allow browser admins; otherwise require a Bearer token matching the stored api_key and matching shop id
        if (!current_user_can('manage_options')) {
            $auth = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] : '');
            if (!preg_match('/Bearer\s+(.+)/', $auth, $m)) {
                return new WP_Error('unauthorized', __('Missing authorization', 'trusthive-reviews'), ['status' => 401]);
            }
            $provided = $m[1];
            if (empty($api_key) || $provided !== $api_key || $shop !== (isset($settings['shop_id']) ? $settings['shop_id'] : '')) {
                return new WP_Error('unauthorized', __('Invalid credentials', 'trusthive-reviews'), ['status' => 401]);
            }
        }

        $cq = new WP_Comment_Query();
        $comments = $cq->query([ 'meta_key' => 'trusthive_shop_id', 'meta_value' => $shop, 'number' => 200 ]);

        $out = [];
        foreach ($comments as $c) {
            $out[] = [
                'id' => intval($c->comment_ID),
                'product_id' => intval($c->comment_post_ID),
                'author' => $c->comment_author,
                'email' => $c->comment_author_email,
                'content' => $c->comment_content,
                'approved' => intval($c->comment_approved),
                'meta' => [
                    'rating' => get_comment_meta($c->comment_ID, 'trusthive_rating', true),
                    'title' => get_comment_meta($c->comment_ID, 'trusthive_title', true),
                ],
                'date' => $c->comment_date_gmt,
            ];
        }

        return rest_ensure_response([ 'ok' => true, 'items' => $out ]);
    }

    public function admin_review_action(WP_REST_Request $request)
    {
        $id = intval($request->get_param('id'));
        $body = $request->get_json_params();
        if (!is_array($body)) {
            $body = $request->get_params();
        }
        $action = isset($body['action']) ? $body['action'] : '';

        $params = $request->get_query_params();
        $shop = isset($params['shop']) ? urldecode($params['shop']) : (isset($body['shop']) ? $body['shop'] : '');
        $ts = isset($params['ts']) ? $params['ts'] : (isset($body['ts']) ? $body['ts'] : '');
        $token = isset($params['token']) ? $params['token'] : (isset($body['token']) ? $body['token'] : '');

        $settings = get_option(TrustHive_Reviews_Admin::OPTION_NAME, []);
        $api_key = isset($settings['api_key']) ? $settings['api_key'] : '';
        // Allow browser admins; otherwise require a Bearer token matching the stored api_key and matching shop id
        if (!current_user_can('manage_options')) {
            $auth = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] : '');
            if (!preg_match('/Bearer\s+(.+)/', $auth, $m)) {
                return new WP_Error('unauthorized', __('Missing authorization', 'trusthive-reviews'), ['status' => 401]);
            }
            $provided = $m[1];
            if (empty($api_key) || $provided !== $api_key || $shop !== (isset($settings['shop_id']) ? $settings['shop_id'] : '')) {
                return new WP_Error('unauthorized', __('Invalid credentials', 'trusthive-reviews'), ['status' => 401]);
            }
        }
        
        if ($action === 'approve') {
            wp_set_comment_status($id, 1);
            return rest_ensure_response([ 'ok' => true ]);
        } elseif ($action === 'hide') {
            wp_set_comment_status($id, 0);
            return rest_ensure_response([ 'ok' => true ]);
        } elseif ($action === 'delete') {
            wp_delete_comment($id, true);
            return rest_ensure_response([ 'ok' => true ]);
        }

        return new WP_Error('invalid_action', __('Unknown action', 'trusthive-reviews'), ['status' => 400]);
    }

}

// Register a lightweight verification endpoint and handler outside the class.
add_action('rest_api_init', function () {
    register_rest_route('trusthive-reviews/v1', '/verify', [
        'methods' => 'POST',
        'callback' => 'trusthive_verify_dashboard_token',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('trusthive-reviews/v1', '/provision', [
        'methods' => 'POST',
        'callback' => 'trusthive_store_credentials',
        'permission_callback' => '__return_true',
    ]);
});

function trusthive_verify_dashboard_token(WP_REST_Request $request) {
    $params = $request->get_json_params();
    $token = isset($params['token']) ? $params['token'] : '';
    if (!is_string($token) || empty($token)) {
        return new WP_Error('missing_token', __('Missing token', 'trusthive-reviews'), ['status' => 400]);
    }

    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    // simple rate limiting per IP: 10 requests per 2 minutes
    $rl_key = 'trusthive_rate_' . $ip;
    $rl = get_transient($rl_key);
    if ($rl) {
        $rl = json_decode($rl, true);
        if (is_array($rl) && isset($rl['count']) && isset($rl['first'])) {
            if (time() - intval($rl['first']) <= 120) {
                if (intval($rl['count']) >= 10) {
                    return new WP_Error('rate_limited', __('Too many requests', 'trusthive-reviews'), ['status' => 429]);
                }
                $rl['count'] = intval($rl['count']) + 1;
            } else {
                $rl = ['count' => 1, 'first' => time()];
            }
        } else {
            $rl = ['count' => 1, 'first' => time()];
        }
    } else {
        $rl = ['count' => 1, 'first' => time()];
    }
    set_transient($rl_key, json_encode($rl), 120);

    $key = 'trusthive_dashboard_token_' . $token;
    $data = get_transient($key);
    if (empty($data) || !is_array($data) || empty($data['user_id'])) {
        return new WP_Error('invalid_or_expired', __('Invalid or expired token', 'trusthive-reviews'), ['status' => 401]);
    }

    // Do NOT delete the transient here; provisioning endpoint will delete it after storing credentials

    $user = get_userdata(intval($data['user_id']));
    if (!$user) {
        return new WP_Error('user_not_found', __('User not found', 'trusthive-reviews'), ['status' => 404]);
    }

    return rest_ensure_response([
        'success' => true,
        'user_id' => intval($user->ID),
        'email' => $user->user_email,
        'display_name' => $user->display_name,
    ]);
}

function trusthive_store_credentials(WP_REST_Request $request) {
    $params = $request->get_json_params();
    $token = isset($params['token']) ? $params['token'] : '';
    $shop_id = isset($params['shop_id']) ? $params['shop_id'] : '';
    $api_key = isset($params['api_key']) ? $params['api_key'] : '';

    if (!is_string($token) || empty($token) || !is_string($shop_id) || empty($shop_id) || !is_string($api_key) || empty($api_key)) {
        return new WP_Error('missing_params', __('Missing parameters', 'trusthive-reviews'), ['status' => 400]);
    }

    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $rl_key = 'trusthive_rate_' . $ip;
    $rl = get_transient($rl_key);
    if ($rl) {
        $rl = json_decode($rl, true);
        if (is_array($rl) && isset($rl['count']) && isset($rl['first'])) {
            if (time() - intval($rl['first']) <= 60) {
                if (intval($rl['count']) >= 6) {
                    return new WP_Error('rate_limited', __('Too many requests', 'trusthive-reviews'), ['status' => 429]);
                }
                $rl['count'] = intval($rl['count']) + 1;
            } else {
                $rl = ['count' => 1, 'first' => time()];
            }
        } else {
            $rl = ['count' => 1, 'first' => time()];
        }
    } else {
        $rl = ['count' => 1, 'first' => time()];
    }
    set_transient($rl_key, json_encode($rl), 60);

    $key = 'trusthive_dashboard_token_' . $token;
    $data = get_transient($key);
    if (empty($data) || !is_array($data) || empty($data['user_id'])) {
        return new WP_Error('invalid_or_expired', __('Invalid or expired token', 'trusthive-reviews'), ['status' => 401]);
    }

    // store credentials in options
    $existing = get_option(TrustHive_Reviews_Admin::OPTION_NAME, []);
    if (!is_array($existing)) $existing = [];
    $existing['shop_id'] = sanitize_text_field($shop_id);
    $existing['api_key'] = sanitize_text_field($api_key);
    update_option(TrustHive_Reviews_Admin::OPTION_NAME, $existing);

    // delete transient to make token single-use
    delete_transient($key);

    return rest_ensure_response([ 'success' => true, 'shop_id' => $existing['shop_id'] ]);
}
