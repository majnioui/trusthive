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

        </div>
        <?php
    }

    // Manual provisioning endpoint (triggered by admin form)










}
