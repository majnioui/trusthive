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
            'methods'  => 'POST',
            'callback' => [$this, 'handle_review'],
            'permission_callback' => function () {
                return wp_verify_nonce(
                    isset($_SERVER['HTTP_X_WP_NONCE']) ? $_SERVER['HTTP_X_WP_NONCE'] : '',
                    'wp_rest'
                );
            },
            'args' => [
                'product_id' => [ 'type' => 'integer', 'required' => true ],
                'author_name' => [ 'type' => 'string', 'required' => true ],
                'author_email' => [ 'type' => 'string', 'required' => true ],
                'rating' => [ 'type' => 'integer', 'required' => true ],
                'title' => [ 'type' => 'string', 'required' => false ],
                'content' => [ 'type' => 'string', 'required' => true ],
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
        $product_id   = absint($request->get_param('product_id'));
        $author_name  = sanitize_text_field($request->get_param('author_name'));
        $author_email = sanitize_email($request->get_param('author_email'));
        $rating       = absint($request->get_param('rating'));
        $title        = sanitize_text_field($request->get_param('title'));
        $content      = sanitize_textarea_field($request->get_param('content'));

        if ($rating < 1 || $rating > 5) {
            return new WP_Error('invalid_rating', __('Rating must be between 1 and 5', 'trusthive-reviews'), ['status' => 400]);
        }

        $admin = new TrustHive_Reviews_Admin();
        $settings = $admin->get_settings();
        $api_base = isset($settings['api_base_url']) ? rtrim($settings['api_base_url'], '/') : '';
        $shop_id  = isset($settings['shop_id']) ? $settings['shop_id'] : '';
        $api_key  = isset($settings['api_key']) ? $settings['api_key'] : '';

        if (empty($api_base) || empty($shop_id)) {
            return new WP_Error('missing_config', __('Plugin not configured: set API Base URL and Shop ID.', 'trusthive-reviews'), ['status' => 400]);
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

        $comment_id = wp_insert_comment($comment_data);
        if ($comment_id && !is_wp_error($comment_id)) {
            add_comment_meta($comment_id, 'trusthive_shop_id', $shop_id, true);
            add_comment_meta($comment_id, 'trusthive_rating', $rating, true);
            if (!empty($title)) {
                add_comment_meta($comment_id, 'trusthive_title', $title, true);
            }
            add_comment_meta($comment_id, 'trusthive_source', get_bloginfo('name'), true);
            add_comment_meta($comment_id, 'trusthive_site_url', site_url(), true);
        }

        $args = [ 'headers' => [ 'Content-Type' => 'application/json' ], 'body' => wp_json_encode($payload), 'timeout' => 15 ];
        if (!empty($api_key)) {
            $args['headers']['Authorization'] = 'Bearer ' . $api_key;
        }

        $url = $api_base . '/reviews';
        $resp = wp_remote_post($url, $args);
        if (is_wp_error($resp)) {
            return new WP_Error('remote_error', $resp->get_error_message(), ['status' => 500]);
        }
        $code = wp_remote_retrieve_response_code($resp);
        $body = wp_remote_retrieve_body($resp);
        if ($code < 200 || $code >= 300) {
            return new WP_Error('remote_error', sprintf(__('Upstream error (%d): %s', 'trusthive-reviews'), $code, $body), ['status' => 500]);
        }

        return new WP_REST_Response([ 'ok' => true ], 200);
    }

    private function verify_sso_token($shop, $ts, $token, $secret, $max_age = 300)
    {
        if (empty($secret) || empty($shop) || empty($ts) || empty($token)) {
            return false;
        }
        if (abs(time() - intval($ts)) > $max_age) {
            return false;
        }
        $expected = hash_hmac('sha256', $shop . '|' . $ts, $secret);
        if (function_exists('hash_equals')) {
            return hash_equals($expected, $token);
        }
        return $expected === $token;
    }

    public function admin_list_reviews(WP_REST_Request $request)
    {
        $params = $request->get_query_params();
        $shop = isset($params['shop']) ? urldecode($params['shop']) : '';
        $ts = isset($params['ts']) ? $params['ts'] : '';
        $token = isset($params['token']) ? $params['token'] : '';

        $admin = new TrustHive_Reviews_Admin();
        $settings = $admin->get_settings();
        $secret = isset($settings['api_key']) ? $settings['api_key'] : '';

        if (!$this->verify_sso_token($shop, $ts, $token, $secret)) {
            return new WP_Error('unauthorized', __('Invalid token', 'trusthive-reviews'), ['status' => 401]);
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

        $admin = new TrustHive_Reviews_Admin();
        $settings = $admin->get_settings();
        $secret = isset($settings['api_key']) ? $settings['api_key'] : '';
        if (!$this->verify_sso_token($shop, $ts, $token, $secret)) {
            return new WP_Error('unauthorized', __('Invalid token', 'trusthive-reviews'), ['status' => 401]);
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
