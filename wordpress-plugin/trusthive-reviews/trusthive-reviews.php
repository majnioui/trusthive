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
