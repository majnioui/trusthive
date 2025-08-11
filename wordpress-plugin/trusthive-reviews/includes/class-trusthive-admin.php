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
        // Manual provisioning endpoint (button in admin UI)
        add_action('admin_post_trusthive_provision', [$this, 'handle_provision']);
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
                'api_base_url'   => '',
                'dashboard_url'  => '',
                'shop_id'        => '',
                'api_key'        => '',
            ],
        ]);

        add_settings_section(
            'trusthive_reviews_main',
            __('Connection', 'trusthive-reviews'),
            function () {
                echo '<p>' . esc_html__('Configure your TrustHive endpoint and identifiers.', 'trusthive-reviews') . '</p>';
            },
            self::OPTION_GROUP
        );

        add_settings_field('api_base_url', __('API Base URL', 'trusthive-reviews'), [$this, 'field_api_base_url'], self::OPTION_GROUP, 'trusthive_reviews_main');
        add_settings_field('dashboard_url', __('Dashboard URL', 'trusthive-reviews'), [$this, 'field_dashboard_url'], self::OPTION_GROUP, 'trusthive_reviews_main');
        add_settings_field('shop_id', __('Shop ID', 'trusthive-reviews'), [$this, 'field_shop_id'], self::OPTION_GROUP, 'trusthive_reviews_main');
        add_settings_field('api_key', __('API Key (Bearer)', 'trusthive-reviews'), [$this, 'field_api_key'], self::OPTION_GROUP, 'trusthive_reviews_main');
    }

    private function get_settings()
    {
        $settings = get_option(self::OPTION_NAME);
        if (!is_array($settings)) {
            $settings = [];
        }
        return wp_parse_args($settings, [
            'api_base_url'  => '',
            'dashboard_url' => '',
            'shop_id'       => '',
            'api_key'       => '',
        ]);
    }

    // (no decrypted settings helper; plugin uses stored DB values)

    public function sanitize_settings($input)
    {
        $existing = get_option(self::OPTION_NAME, []);
        return [
            'api_base_url'  => isset($input['api_base_url']) ? esc_url_raw($input['api_base_url']) : (isset($existing['api_base_url']) ? $existing['api_base_url'] : ''),
            'dashboard_url' => isset($input['dashboard_url']) ? esc_url_raw($input['dashboard_url']) : (isset($existing['dashboard_url']) ? $existing['dashboard_url'] : ''),
            // keep existing shop_id/api_key unless explicitly provided (we do not expose these fields in the UI)
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
        if (!empty($settings['dashboard_url'])) {
            // Build a short-lived HMAC token so the owner can open the external dashboard
            // without re-authenticating. The external app (hosted on your server) should
            // verify `shop`, `ts` and `token` using the shared `api_key` as secret.
            $shop_value = $settings['shop_id'] ?: site_url();
            $args = [
                'shop' => rawurlencode($shop_value),
            ];

            // If an API key is provided, attach an HMAC token and timestamp for SSO.
            if (!empty($settings['api_key'])) {
                $ts = time();
                $token_payload = $shop_value . '|' . $ts;
                $token = hash_hmac('sha256', $token_payload, $settings['api_key']);
                $args['ts'] = $ts;
                $args['token'] = $token;
            }

            $dashboard_link = esc_url(add_query_arg($args, $settings['dashboard_url']));
        }

        // Show admin notice after provisioning (legacy flow uses query params)
        if (isset($_GET['provisioned']) && $_GET['provisioned'] === '1') {
            echo '<div class="updated notice is-dismissible"><p>' . esc_html__('Shop provisioned and credentials saved.', 'trusthive-reviews') . '</p></div>';
        } elseif (isset($_GET['provision_error'])) {
            echo '<div class="error notice is-dismissible"><p>' . esc_html__('Provisioning failed: ', 'trusthive-reviews') . esc_html($_GET['provision_error']) . '</p></div>';
        }

        ?>
        <div class="wrap">
            <h1><?php echo esc_html__('TrustHive Reviews', 'trusthive-reviews'); ?></h1>
            <form method="post" action="options.php">
                <?php
                settings_fields(self::OPTION_GROUP);
                do_settings_sections(self::OPTION_GROUP);
                submit_button(__('Save Settings', 'trusthive-reviews'));
                ?>
            </form>

            <?php if ($dashboard_link) : ?>
                <p>
                    <a class="button button-primary" href="<?php echo $dashboard_link; ?>" target="_blank" rel="noopener noreferrer">
                        <?php echo esc_html__('Open TrustHive Dashboard', 'trusthive-reviews'); ?>
                    </a>
                </p>
            <?php endif; ?>

            <?php if (!empty($settings['dashboard_url'])) : ?>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <?php wp_nonce_field('trusthive_provision_action', 'trusthive_provision_nonce'); ?>
                    <input type="hidden" name="action" value="trusthive_provision" />
                    <p>
                        <button class="button" type="submit"><?php echo esc_html__('Provision shop on dashboard', 'trusthive-reviews'); ?></button>
                        <span class="description"><?php echo esc_html__('Creates a shop account on your configured dashboard and saves the returned shop id and API key.', 'trusthive-reviews'); ?></span>
                    </p>
                </form>
            <?php endif; ?>
        </div>
        <?php
    }

    // Manual provisioning endpoint (triggered by admin form)
    public function handle_provision()
    {
        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized', 'trusthive-reviews'));
        }
        if (!isset($_POST['trusthive_provision_nonce']) || !wp_verify_nonce($_POST['trusthive_provision_nonce'], 'trusthive_provision_action')) {
            wp_die(__('Invalid nonce', 'trusthive-reviews'));
        }

        $settings = $this->get_settings();
        $dashboard = rtrim($settings['dashboard_url'], '/');
        if (empty($dashboard)) {
            $url = add_query_arg(['page' => 'trusthive-reviews', 'provision_error' => 'missing_dashboard_url'], admin_url('admin.php'));
            wp_redirect($url);
            exit;
        }

        $payload = [
            'site_url' => site_url(),
            'site_name' => get_bloginfo('name'),
            'admin_email' => get_option('admin_email'),
        ];

        $resp = wp_remote_post($dashboard . '/api/register', [
            'headers' => [ 'Content-Type' => 'application/json' ],
            'body' => wp_json_encode($payload),
            'timeout' => 15,
        ]);

        if (is_wp_error($resp)) {
            $url = add_query_arg(['page' => 'trusthive-reviews', 'provision_error' => rawurlencode($resp->get_error_message())], admin_url('admin.php'));
            wp_redirect($url);
            exit;
        }

        $code = wp_remote_retrieve_response_code($resp);
        $body = wp_remote_retrieve_body($resp);
        $data = json_decode($body, true);
        if ($code < 200 || $code >= 300 || empty($data) || empty($data['ok'])) {
            $err = isset($data['error']) ? $data['error'] : $body;
            $url = add_query_arg(['page' => 'trusthive-reviews', 'provision_error' => rawurlencode($err)], admin_url('admin.php'));
            wp_redirect($url);
            exit;
        }

        // store returned shop id and api key in settings
        $settings['shop_id'] = isset($data['shop_id']) ? sanitize_text_field($data['shop_id']) : $settings['shop_id'];
        $settings['api_key'] = isset($data['api_key']) ? sanitize_text_field($data['api_key']) : $settings['api_key'];
        update_option(self::OPTION_NAME, $settings);

        $url = add_query_arg(['page' => 'trusthive-reviews', 'provisioned' => '1'], admin_url('admin.php'));
        wp_redirect($url);
        exit;
    }

    public function field_api_base_url()
    {
        $settings = $this->get_settings();
        printf(
            '<input type="url" name="%1$s[api_base_url]" value="%2$s" class="regular-text" placeholder="https://api.example.com" />',
            esc_attr(self::OPTION_NAME),
            esc_attr($settings['api_base_url'])
        );
    }

    public function field_dashboard_url()
    {
        $settings = $this->get_settings();
        printf(
            '<input type="url" name="%1$s[dashboard_url]" value="%2$s" class="regular-text" placeholder="https://dashboard.example.com" />',
            esc_attr(self::OPTION_NAME),
            esc_attr($settings['dashboard_url'])
        );
    }

    public function field_shop_id()
    {
        $settings = $this->get_settings();
        printf(
            '<input type="text" name="%1$s[shop_id]" value="%2$s" class="regular-text" placeholder="your-shop-id" />',
            esc_attr(self::OPTION_NAME),
            esc_attr($settings['shop_id'])
        );
    }

    public function field_api_key()
    {
        $settings = $this->get_settings();
        printf(
            '<input type="password" name="%1$s[api_key]" value="%2$s" class="regular-text" autocomplete="new-password" />',
            esc_attr(self::OPTION_NAME),
            esc_attr($settings['api_key'])
        );
    }
}
