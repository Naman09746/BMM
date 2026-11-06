<?php
/**
 * Plugin Name: BDS Marvel Hero Performance Fix
 * Description: Preloads the homepage hero poster and prevents its background video from downloading before the hero is ready.
 * Version: 1.1.0
 * Author: BDS Marvel
 */
if (!defined('ABSPATH')) { exit; }

add_action('wp_head', function () {
    if (is_admin() || !is_front_page()) { return; }
    ?>
    <link rel="preload" as="image" href="https://bdsmarvel.com/wp-content/plugins/bds-craftsmanship-hero/assets/craftsmanship-poster.webp" fetchpriority="high">
    <script id="bds-defer-hero-video">
    (function () {
        'use strict';
        var descriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
        if (!descriptor || !descriptor.get || !descriptor.set || !descriptor.configurable) { return; }
        Object.defineProperty(HTMLMediaElement.prototype, 'src', {
            configurable: true,
            enumerable: descriptor.enumerable,
            get: function () { return descriptor.get.call(this); },
            set: function (value) {
                if (this instanceof HTMLVideoElement && !this.isConnected &&
                    typeof value === 'string' && value.indexOf('/bds-craftsmanship-hero/assets/craftsmanship.mp4') !== -1) {
                    this.dataset.bdsDeferredVideoSrc = value;
                    return;
                }
                descriptor.set.call(this, value);
            }
        });
    })();
    </script>
    <?php
}, 0);
