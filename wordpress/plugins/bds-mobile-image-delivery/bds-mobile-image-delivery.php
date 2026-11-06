<?php
/**
 * Plugin Name: BDS Marvel Mobile Image Delivery
 * Description: Reduces oversized Unsplash image downloads on small screens without changing the hero video or layout.
 * Version: 1.0.0
 * Author: BDS Marvel
 */
if (!defined('ABSPATH')) { exit; }
add_action('wp_head', function () {
    if (is_admin()) { return; }
    ?>
    <script id="bds-mobile-image-delivery">
    (function () {
      'use strict';
      var mobile = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
      var limit = mobile ? 1100 : 1600;
      function imageUrl(value) {
        if (typeof value !== 'string' || value.indexOf('images.unsplash.com/') === -1) return value;
        try {
          var u = new URL(value, document.baseURI);
          var width = parseInt(u.searchParams.get('w'), 10);
          if (!width || width > limit) u.searchParams.set('w', String(limit));
          var quality = parseInt(u.searchParams.get('q'), 10);
          if (!quality || quality > 72) u.searchParams.set('q', '72');
          u.searchParams.set('auto', 'format');
          return u.href;
        } catch (_) { return value; }
      }
      function imageSet(value) {
        if (typeof value !== 'string') return value;
        return value.split(',').map(function (candidate) {
          var bits = candidate.trim().split(/\s+/);
          if (!bits[0]) return candidate;
          bits[0] = imageUrl(bits[0]);
          if (bits[1] && /w$/.test(bits[1])) {
            var width = parseInt(bits[1], 10);
            if (width > limit) bits[1] = limit + 'w';
          }
          return bits.join(' ');
        }).join(', ');
      }
      var src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      var srcset = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'srcset');
      if (src && src.set && src.get && src.configurable) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
          configurable: true, enumerable: src.enumerable,
          get: function () { return src.get.call(this); },
          set: function (value) { src.set.call(this, imageUrl(value)); }
        });
      }
      if (srcset && srcset.set && srcset.get && srcset.configurable) {
        Object.defineProperty(HTMLImageElement.prototype, 'srcset', {
          configurable: true, enumerable: srcset.enumerable,
          get: function () { return srcset.get.call(this); },
          set: function (value) { srcset.set.call(this, imageSet(value)); }
        });
      }
      var setAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function (name, value) {
        var lower = String(name).toLowerCase();
        if (this instanceof HTMLImageElement) {
          if (lower === 'src') value = imageUrl(String(value));
          else if (lower === 'srcset') value = imageSet(String(value));
        }
        return setAttribute.call(this, name, value);
      };
    })();
    </script>
    <?php
}, 0);
