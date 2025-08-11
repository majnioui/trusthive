<?php

if (!defined('ABSPATH')) {
    exit;
}

class TrustHive_Reviews_Admin
{
    const OPTION_GROUP = 'trusthive_reviews_options';
    const OPTION_NAME  = 'trusthive_reviews_settings';

    public function init()
    {
        add_action('admin_menu', [$this, 'register_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('admin_post_trusthive_register', [$this, 'handle_register']);
    }

    public function register_menu()
    {
        // Register a top-level admin menu for the plugin instead of a submenu under Settings
        add_menu_page(
            __('TrustHive Reviews', 'trusthive-reviews'),
            __('TrustHive Reviews', 'trusthive-reviews'),
            'manage_options',
            'trusthive-reviews',
            [$this, 'render_settings_page'],
            'dashicons-star-filled',
            57
        );
    }

    public function register_settings()
    {
        register_setting(self::OPTION_GROUP, self::OPTION_NAME, [
            'type' => 'array',
            'sanitize_callback' => [$this, 'sanitize_settings'],
            'default' => [
                'shop_id'        => '',
                'api_key'        => '',
            ],
        ]);

        // We intentionally do not expose any settings fields to the admin UI.
        // Credentials (shop_id/api_key) are generated automatically and kept hidden.
    }

        private function get_settings()
    {
        $settings = get_option(self::OPTION_NAME);
        if (!is_array($settings)) {
            $settings = [];
        }
        return wp_parse_args($settings, [
            'shop_id'       => '',
            'api_key'       => '',
        ]);
    }

    // (no decrypted settings helper; plugin uses stored DB values)

    public function sanitize_settings($input)
    {
        $existing = get_option(self::OPTION_NAME, []);
        // keep existing shop_id/api_key unless explicitly provided (we do not expose these fields in the UI)
        return [
            'shop_id'       => isset($input['shop_id']) ? sanitize_text_field($input['shop_id']) : (isset($existing['shop_id']) ? $existing['shop_id'] : ''),
            'api_key'       => isset($input['api_key']) ? sanitize_text_field($input['api_key']) : (isset($existing['api_key']) ? $existing['api_key'] : ''),
        ];
    }

    // encryption helpers removed — API key stored directly in DB unless defined in wp-config.php




    public function render_settings_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $settings = $this->get_settings();
        $dashboard_link = '';
        // Dashboard and API host are hardcoded to the configured site URL constant.
        if (defined('TRUSTHIVE_REVIEWS_SITE_URL') && TRUSTHIVE_REVIEWS_SITE_URL) {
            // Build a short-lived HMAC token so the owner can open the external dashboard
            // without re-authenticating. The external app should verify `shop`, `ts` and
            // `token` using the shared `api_key` as secret.
            $shop_value = $settings['shop_id'] ?: site_url();
            $args = [ 'shop' => rawurlencode($shop_value) ];

            if (!empty($settings['api_key'])) {
                $ts = time();
                $token_payload = $shop_value . '|' . $ts;
                $token = hash_hmac('sha256', $token_payload, $settings['api_key']);
                $args['ts'] = $ts;
                $args['token'] = $token;
            }

            $dashboard_link = esc_url(add_query_arg($args, rtrim(TRUSTHIVE_REVIEWS_SITE_URL, '/') . '/dashboard'));
        }

        // Show admin notices: registration error transient or legacy query params
        $reg_err = get_transient('trusthive_register_error');
        if ($reg_err) {
            echo '<div class="error notice is-dismissible"><p>' . esc_html__('Registration to TrustHive failed:', 'trusthive-reviews') . ' ' . esc_html($reg_err) . '</p></div>';
            delete_transient('trusthive_register_error');
        }
        if (isset($_GET['provisioned']) && $_GET['provisioned'] === '1') {
            echo '<div class="updated notice is-dismissible"><p>' . esc_html__('Shop provisioned and credentials saved.', 'trusthive-reviews') . '</p></div>';
        } elseif (isset($_GET['provision_error'])) {
            if ($_GET['provision_error'] === 'already_provisioned') {
                echo '<div class="notice notice-warning is-dismissible"><p>' . esc_html__('Shop is already provisioned. Duplicate provisioning was prevented.', 'trusthive-reviews') . '</p></div>';
            } else {
                echo '<div class="error notice is-dismissible"><p>' . esc_html__('Provisioning failed: ', 'trusthive-reviews') . esc_html($_GET['provision_error']) . '</p></div>';
            }
        }

        ?>
        <div class="wrap">
            <h1><?php echo esc_html__('TrustHive Reviews', 'trusthive-reviews'); ?></h1>

            <?php if ($dashboard_link) : ?>
                <p>
                    <a class="button button-primary" href="<?php echo $dashboard_link; ?>" target="_blank" rel="noopener noreferrer">
                        <?php echo esc_html__('Open TrustHive Dashboard', 'trusthive-reviews'); ?>
                    </a>
                </p>

            <!-- External dashboard link above. Credentials hidden. -->

            <?php endif; ?>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-top:12px;">
                <?php wp_nonce_field('trusthive_register_action', 'trusthive_register_nonce'); ?>
                <input type="hidden" name="action" value="trusthive_register" />
                <?php if (!empty($settings['shop_id'])): ?>
                    <p><strong><?php echo esc_html__('Current Shop ID:', 'trusthive-reviews'); ?></strong> <?php echo esc_html($settings['shop_id']); ?></p>
                    <label><input type="checkbox" name="overwrite" value="1" /> <?php echo esc_html__('Overwrite existing remote shop (dangerous)', 'trusthive-reviews'); ?></label>
                <?php else: ?>
                    <p><?php echo esc_html__('No remote shop registered yet. Click the button below to create one.', 'trusthive-reviews'); ?></p>
                <?php endif; ?>
                <p>
                    <button class="button" type="submit"><?php echo esc_html__('Sync Shop', 'trusthive-reviews'); ?></button>
                    <span class="description"><?php echo esc_html__('Registers your site on the TrustHive dashboard or syncs credentials. Only use overwrite if you know what you are doing.', 'trusthive-reviews'); ?></span>
                </p>
            </form>

        </div>
        <?php
    }

    // Manual provisioning endpoint (triggered by admin form)

    // Manual registration endpoint (triggered by admin form)
    public function handle_register()
    {
        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized', 'trusthive-reviews'));
        }
        if (!isset($_POST['trusthive_register_nonce']) || !wp_verify_nonce($_POST['trusthive_register_nonce'], 'trusthive_register_action')) {
            wp_die(__('Invalid nonce', 'trusthive-reviews'));
        }

        $settings = $this->get_settings();
        $overwrite = isset($_POST['overwrite']) && $_POST['overwrite'] == '1';

        if (!empty($settings['shop_id']) && !$overwrite) {
            $url = add_query_arg(['page' => 'trusthive-reviews', 'register_error' => 'already_exists'], admin_url('admin.php'));
            wp_redirect($url);
            exit;
        }

        $dashboard = rtrim(defined('TRUSTHIVE_REVIEWS_SITE_URL') ? TRUSTHIVE_REVIEWS_SITE_URL : '', '/');
        if (empty($dashboard)) {
            $url = add_query_arg(['page' => 'trusthive-reviews', 'register_error' => 'missing_dashboard_url'], admin_url('admin.php'));
            wp_redirect($url);
            exit;
        }

        $payload = [
            'site_url' => get_site_url(),
            'site_name' => get_bloginfo('name'),
            'admin_email' => get_option('admin_email'),
        ];

        $resp = null;
        if (function_exists('wp_remote_post')) {
            $resp = wp_remote_post($dashboard . '/api/register', [
                'headers' => [ 'Content-Type' => 'application/json' ],
                'body' => wp_json_encode($payload),
                'timeout' => 15,
            ]);
        }

        if ($resp && !is_wp_error($resp)) {
            $code = wp_remote_retrieve_response_code($resp);
            $body = wp_remote_retrieve_body($resp);
            $data = json_decode($body, true);
            if ($code >= 200 && $code < 300 && !empty($data) && !empty($data['ok'])) {
                $settings['shop_id'] = isset($data['shop_id']) ? sanitize_text_field($data['shop_id']) : $settings['shop_id'];
                $settings['api_key'] = isset($data['api_key']) ? sanitize_text_field($data['api_key']) : $settings['api_key'];
                update_option(self::OPTION_NAME, $settings);

                $url = add_query_arg(['page' => 'trusthive-reviews', 'registered' => '1'], admin_url('admin.php'));
                wp_redirect($url);
                exit;
            }
            $err = isset($data['error']) ? $data['error'] : $body;
            set_transient('trusthive_register_error', $err, 60*60);
        } else {
            $err = $resp ? $resp->get_error_message() : __('HTTP unavailable', 'trusthive-reviews');
            set_transient('trusthive_register_error', $err, 60*60);
        }

        $url = add_query_arg(['page' => 'trusthive-reviews', 'register_error' => '1'], admin_url('admin.php'));
        wp_redirect($url);
        exit;
    }

}
