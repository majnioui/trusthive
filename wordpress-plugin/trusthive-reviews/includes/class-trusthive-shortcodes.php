<?php

if (!defined('ABSPATH')) {
    exit;
}

class TrustHive_Reviews_Shortcodes
{
    public function init()
    {
        add_shortcode('trusthive_reviews', [$this, 'render_reviews_form']);
        add_action('wp_enqueue_scripts', [$this, 'register_assets']);
    }

    public function register_assets()
    {
        wp_register_script(
            'trusthive-reviews-form',
            TRUSTHIVE_REVIEWS_PLUGIN_URL . 'assets/js/form.js',
            ['wp-api-fetch'],
            TRUSTHIVE_REVIEWS_VERSION,
            true
        );
    }

    public function render_reviews_form($atts = [])
    {
        $atts = shortcode_atts([
            'product_id' => 0,
        ], $atts, 'trusthive_reviews');

        $product_id = absint($atts['product_id']);
        if (!$product_id) {
            $product_id = get_the_ID();
        }

        // Localize script with API details and nonce
        $settings = get_option(TrustHive_Reviews_Admin::OPTION_NAME, []);
        wp_enqueue_script('trusthive-reviews-form');
        wp_localize_script('trusthive-reviews-form', 'TrustHiveReviews', [
            'endpoint' => esc_url_raw(rest_url('trusthive/v1/review')),
            'nonce'    => wp_create_nonce('wp_rest'),
            'productId'=> $product_id,
        ]);

        ob_start();
        ?>
        <form class="trusthive-review-form" data-product-id="<?php echo esc_attr($product_id); ?>">
            <div class="thr-field">
                <label><?php echo esc_html__('Name', 'trusthive-reviews'); ?></label>
                <input type="text" name="author_name" required />
            </div>
            <div class="thr-field">
                <label><?php echo esc_html__('Email', 'trusthive-reviews'); ?></label>
                <input type="email" name="author_email" required />
            </div>
            <div class="thr-field">
                <label><?php echo esc_html__('Rating (1-5)', 'trusthive-reviews'); ?></label>
                <input type="number" min="1" max="5" name="rating" required />
            </div>
            <div class="thr-field">
                <label><?php echo esc_html__('Title', 'trusthive-reviews'); ?></label>
                <input type="text" name="title" />
            </div>
            <div class="thr-field">
                <label><?php echo esc_html__('Review', 'trusthive-reviews'); ?></label>
                <textarea name="content" rows="5" required></textarea>
            </div>
            <button type="submit"><?php echo esc_html__('Submit Review', 'trusthive-reviews'); ?></button>
            <div class="thr-message" style="margin-top:8px;"></div>
        </form>
        <?php
        return ob_get_clean();
    }
}

