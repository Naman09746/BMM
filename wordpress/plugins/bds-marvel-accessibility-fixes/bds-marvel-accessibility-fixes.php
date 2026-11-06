<?php
/**
 * Plugin Name: BDS Marvel Accessibility and Script Delivery Fixes
 * Description: Improves homepage accessibility and starts Google measurement scripts after page interaction.
 * Version: 1.8.0
 * Author: BDS Marvel
 */
if (!defined('ABSPATH')) { exit; }

add_action('template_redirect', function () {
    if (is_admin() || !is_front_page()) { return; }

    ob_start(function ($html) {
        // Remove only the identified Google Tag Manager container from the homepage.
        // Keep the separate Google tag (gtag.js) and its measurement configuration intact.
        $html = preg_replace_callback('~<script\b[^>]*>[\s\S]*?</script>~i', function ($match) {
            $script = $match[0];
            if (preg_match('~GTM-TFG9WTR2~i', $script) && preg_match('~googletagmanager\.com/gtm\.js~i', $script)) {
                return '';
            }
            return $script;
        }, $html);

        $html = preg_replace_callback('~<script\b[^>]*\bsrc\s*=\s*(["\'])([^"\']+)\1[^>]*>\s*</script>~i', function ($match) {
            $src = $match[2];
            $google_script = preg_match('~(?:www\.)?googletagmanager\.com/gtag/js|accounts\.google\.com/gsi/client|google-site-kit/dist/assets/js/sign-in-with-google-[^"\']*\.js~i', $src);
            if (!$google_script) { return $match[0]; }
            // Public visitors do not use Google sign-in on the homepage. Avoid triggering FedCM there;
            // the Google sign-in SDK remains available on the site's other pages.
            if (preg_match('~accounts\.google\.com/gsi/client|google-site-kit/dist/assets/js/sign-in-with-google-~i', $src)) { return ''; }
            return preg_replace_callback('~\bsrc\s*=\s*(["\'])([^"\']+)\1~i', function ($attribute) {
                return 'data-bds-lazy-src=' . $attribute[1] . $attribute[2] . $attribute[1];
            }, $match[0], 1);
        }, $html);

        $html = preg_replace_callback('~<script\b([^>]*)>([\s\S]*?GTM-TFG9WTR2[\s\S]*?)</script>~i', function ($match) {
            $attributes = preg_replace('~\s+type\s*=\s*(["\'])[^"\']*\1~i', '', $match[1]);
            return '<script' . $attributes . ' type="text/plain" data-bds-lazy-inline="true">' . $match[2] . '</script>';
        }, $html, 1);

        if (strpos($html, 'data-bds-lazy-src=') === false && strpos($html, 'data-bds-lazy-inline=') === false) { return $html; }
        $loader = <<<'BDS_GOOGLE_LOADER'
<script id="bds-delay-google-scripts">(function(){var started=false;var load=function(){if(started)return;started=true;document.querySelectorAll("script[data-bds-lazy-inline]").forEach(function(old){var next=document.createElement("script");Array.prototype.forEach.call(old.attributes,function(attr){if(attr.name!=="type"&&attr.name!=="data-bds-lazy-inline"){next.setAttribute(attr.name,attr.value);}});next.text=old.textContent;old.parentNode.replaceChild(next,old);});document.querySelectorAll("script[data-bds-lazy-src]").forEach(function(old){var next=document.createElement("script");Array.prototype.forEach.call(old.attributes,function(attr){if(attr.name!=="data-bds-lazy-src"){next.setAttribute(attr.name,attr.value);}});next.async=old.hasAttribute("async");next.src=old.getAttribute("data-bds-lazy-src");old.parentNode.replaceChild(next,old);});};var arm=function(){window.addEventListener("pointerdown",load,{once:true,passive:true});window.addEventListener("keydown",load,{once:true});window.addEventListener("touchstart",load,{once:true,passive:true});};if(document.readyState==="complete"){setTimeout(arm,0);}else{window.addEventListener("load",arm,{once:true});}})();</script>
BDS_GOOGLE_LOADER;
        return preg_replace('~</body>~i', $loader . '</body>', $html, 1);
    });
}, 0);

add_action('wp_footer', function () {
    if (is_admin() || !is_front_page()) { return; }
    ?>
    <script id="bds-marvel-accessibility-fixes">
    (function () {
        'use strict';
        function applyAccessibilityFixes() {
            document.querySelectorAll('[data-testid="purpose-previous-button"]').forEach(function (button) {
                if (button.getAttribute('aria-label') !== 'Previous approach') {
                    button.setAttribute('aria-label', 'Previous approach');
                }
            });
            document.querySelectorAll('[data-testid="purpose-next-button"]').forEach(function (button) {
                if (button.getAttribute('aria-label') !== 'Next approach') {
                    button.setAttribute('aria-label', 'Next approach');
                }
            });
            document.querySelectorAll('.network-panel__copy > h3').forEach(function (heading) {
                if (heading.getAttribute('role') !== 'heading') {
                    heading.setAttribute('role', 'heading');
                }
                if (heading.getAttribute('aria-level') !== '2') {
                    heading.setAttribute('aria-level', '2');
                }
            });
            document.querySelectorAll('.zoo-site .contact-section .contact-orbit em').forEach(function (text) {
                if (text.style.getPropertyValue('color') !== '#493310') {
                    text.style.setProperty('color', '#493310', 'important');
                }
            });
        }
        applyAccessibilityFixes();
        var observer = new MutationObserver(applyAccessibilityFixes);
        observer.observe(document.documentElement, { childList: true, subtree: true });
    })();
    </script>
    <?php
}, 99);
