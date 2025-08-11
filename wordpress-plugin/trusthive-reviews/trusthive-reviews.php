<?php
/**
 * Plugin Name: TrustHive Reviews for WooCommerce
 * Description: Collect product reviews via shortcode and forward them to an external TrustHive dashboard. Includes basic settings and a dashboard link.
 * Version: 0.1.0
 * Author: TrustHive
 * License: GPL2
 * Text Domain: trusthive-reviews
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

define('TRUSTHIVE_REVIEWS_VERSION', '0.1.0');
define('TRUSTHIVE_REVIEWS_PLUGIN_FILE', __FILE__);
define('TRUSTHIVE_REVIEWS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('TRUSTHIVE_REVIEWS_PLUGIN_URL', plugin_dir_url(__FILE__));

define('TRUSTHIVE_REVIEWS_SITE_URL', 'https://fair-muskox-certainly.ngrok-free.app');

// Includes
require_once TRUSTHIVE_REVIEWS_PLUGIN_DIR . 'includes/class-trusthive-admin.php';
require_once TRUSTHIVE_REVIEWS_PLUGIN_DIR . 'includes/class-trusthive-shortcodes.php';
require_once TRUSTHIVE_REVIEWS_PLUGIN_DIR . 'includes/class-trusthive-rest.php';

// Init
add_action('plugins_loaded', function () {
    (new TrustHive_Reviews_Admin())->init();
    (new TrustHive_Reviews_Shortcodes())->init();
    (new TrustHive_Reviews_REST())->init();
});

// Add settings link on Plugins page
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    $settings_link = '<a href="' . esc_url(admin_url('admin.php?page=trusthive-reviews')) . '">' . esc_html__('Settings', 'trusthive-reviews') . '</a>';
    array_unshift($links, $settings_link);
    return $links;
});


/**
 * Activation hook: ensure credentials are generated once on activation.
 */
function trusthive_reviews_activate()
{
    $opt_name = TrustHive_Reviews_Admin::OPTION_NAME;
    $settings = get_option($opt_name, []);
    if (!is_array($settings)) {
        $settings = [];
    }

    $updated = false;
    $registered = false;

    // Attempt remote registration first if we don't already have a shop_id
    $dashboard = rtrim(defined('TRUSTHIVE_REVIEWS_SITE_URL') ? TRUSTHIVE_REVIEWS_SITE_URL : '', '/');
    if (empty($settings['shop_id']) && !empty($dashboard) && function_exists('wp_remote_post')) {
        $payload = [
            'site_url' => get_site_url(),
            'site_name' => get_bloginfo('name'),
            'admin_email' => get_option('admin_email'),
        ];
        $args = [
            'headers' => [ 'Content-Type' => 'application/json' ],
            'body' => wp_json_encode($payload),
            'timeout' => 20,
        ];
        $resp = wp_remote_post($dashboard . '/api/register', $args);
        if (!is_wp_error($resp)) {
            $code = wp_remote_retrieve_response_code($resp);
            $body = wp_remote_retrieve_body($resp);
            $data = json_decode($body, true);
            if ($code >= 200 && $code < 300 && !empty($data) && !empty($data['ok'])) {
                if (!empty($data['shop_id'])) {
                    $settings['shop_id'] = sanitize_text_field($data['shop_id']);
                }
                if (!empty($data['api_key'])) {
                    $settings['api_key'] = sanitize_text_field($data['api_key']);
                }
                $registered = true;
            } else {
                set_transient('trusthive_register_error', isset($data['error']) ? $data['error'] : $body, 60*60);
            }
        } else {
            set_transient('trusthive_register_error', $resp->get_error_message(), 60*60);
        }
    }

    // If remote registration didn't happen, generate local credentials as fallback
    if (!$registered) {
        if (empty($settings['shop_id'])) {
            if (function_exists('wp_generate_uuid4')) {
                $settings['shop_id'] = wp_generate_uuid4();
            } else {
                $settings['shop_id'] = uniqid('shop_', true);
            }
            $updated = true;
        }

        if (empty($settings['api_key'])) {
            if (function_exists('wp_generate_password')) {
                $settings['api_key'] = wp_generate_password(48, true, true);
            } elseif (function_exists('random_bytes')) {
                $settings['api_key'] = bin2hex(random_bytes(24));
            } elseif (function_exists('openssl_random_pseudo_bytes')) {
                $settings['api_key'] = bin2hex(openssl_random_pseudo_bytes(24));
            } else {
                $settings['api_key'] = uniqid('key_', true);
            }
            $updated = true;
        }
    }

    if ($registered || $updated) {
        update_option($opt_name, $settings);
    }
}

register_activation_hook(__FILE__, 'trusthive_reviews_activate');
