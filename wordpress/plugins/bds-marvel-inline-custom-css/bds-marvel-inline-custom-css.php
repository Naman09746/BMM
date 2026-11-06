<?php
/**
 * Plugin Name: BDS Marvel Inline Homepage Custom CSS
 * Description: Inlines the homepage's existing WordPress custom CSS to remove its separate render-blocking request.
 * Version: 1.1.0
 * Author: BDS Marvel
 */
if (!defined('ABSPATH')) { exit; }

add_action('template_redirect', function () {
    if (is_admin() || !is_front_page() || !function_exists('wp_get_custom_css')) {
        return;
    }

    $css = wp_get_custom_css();
    if (!is_string($css) || trim($css) === '') {
        return;
    }

    ob_start(function ($html) use ($css) {
        return preg_replace_callback('~<link\b[^>]*>~i', function ($match) use ($css) {
            if (strpos($match[0], 'custom-css=') === false) {
                return $match[0];
            }

            return '<style id="bds-inline-homepage-custom-css">' . $css . '</style>';
        }, $html);
    });
}, 0);

add_filter('style_loader_tag', function ($html, $handle, $href) {
    if (!is_front_page() || stripos($href, 'custom-css=') === false) {
        return $html;
    }

    if (!function_exists('wp_get_custom_css')) {
        return $html;
    }

    $css = wp_get_custom_css();
    if (!is_string($css) || trim($css) === '') {
        return $html;
    }

    return '<style id="bds-inline-homepage-custom-css">' . $css . '</style>';
}, 100, 3);
