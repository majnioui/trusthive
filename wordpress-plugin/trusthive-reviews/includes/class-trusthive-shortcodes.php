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
        wp_register_style(
            'trusthive-reviews-style',
            TRUSTHIVE_REVIEWS_PLUGIN_URL . 'assets/css/form.css',
            [],
            TRUSTHIVE_REVIEWS_VERSION
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
        wp_enqueue_style('trusthive-reviews-style');
        wp_localize_script('trusthive-reviews-form', 'TrustHiveReviews', [
            'endpoint' => esc_url_raw(rest_url('trusthive/v1/review')),
            'nonce'    => wp_create_nonce('wp_rest'),
            'productId'=> $product_id,
        ]);

        ob_start();
        ?>
        <div class="trusthive-review-widget" data-product-id="<?php echo esc_attr($product_id); ?>">
            <div class="trusthive-review-toggle">
                <button type="button">
                    Write a review
                </button>
            </div>

            <form class="trusthive-review-form" data-product-id="<?php echo esc_attr($product_id); ?>">
                <div class="thr-field">
                    <label><?php echo esc_html__('Rating', 'trusthive-reviews'); ?></label>
                    <div class="thr-stars" aria-label="Rating">
                        <?php for ($i = 1; $i <= 5; $i++): ?>
                            <span class="thr-star" role="button" tabindex="0" aria-label="Set rating to <?php echo $i; ?>">
                                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .587l3.668 7.431L24 9.748l-6 5.848 1.416 8.264L12 19.771 4.584 23.86 6 15.596 0 9.748l8.332-1.73z"/></svg>
                            </span>
                        <?php endfor; ?>
                    </div>
                    <div class="thr-rating-meta"><span class="thr-rating-value">0</span><span class="thr-rating-max">/5</span></div>
                    <input type="hidden" name="rating" value="0" required />
                </div>

                <div class="thr-name-email">
                    <div class="thr-field">
                        <label><?php echo esc_html__('Name', 'trusthive-reviews'); ?></label>
                        <input type="text" name="author_name" required />
                    </div>
                    <div class="thr-field">
                        <label><?php echo esc_html__('Email', 'trusthive-reviews'); ?></label>
                        <input type="email" name="author_email" required />
                    </div>
                </div>

                <div class="thr-field thr-subject">
                    <label><?php echo esc_html__('Subject', 'trusthive-reviews'); ?></label>
                    <input type="text" name="title" />
                </div>

                <div class="thr-field">
                    <label><?php echo esc_html__('Review', 'trusthive-reviews'); ?></label>
                    <textarea name="content" rows="5" required></textarea>
                </div>

                <button type="submit"><?php echo esc_html__('Submit Review', 'trusthive-reviews'); ?></button>
                <div class="thr-message" style="margin-top:8px;"></div>
            </form>

            <div class="trusthive-reviews-display">
                <!-- Reviews will be loaded here when the form is opened -->
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}
