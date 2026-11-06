<?php
/**
 * Plugin Name: BDS Marvel Performance & Accessibility Fixes
 * Description: Loads responsive image, accessibility, and deferred hero enhancements for BDS Marvel.
 * Version: 1.7.2
 */
if (!defined('ABSPATH')) { exit; }
// Google Tag Manager is inserted once by Site Kit.
// The new renderer is restricted to an explicit preview URL until verified live.
function bds_performance_candidate_request() {
    return !isset($_GET['bds_runtime']) || $_GET['bds_runtime'] !== 'react-rollback';
}
add_action('wp_head', function () {
    $poster = content_url('/plugins/bds-craftsmanship-hero/assets/craftsmanship-poster.webp');
    echo '<link rel="preload" as="image" href="' . esc_url($poster) . '" fetchpriority="high">' . "\n";
    ?>
<?php
}, 0);
add_action('wp_enqueue_scripts', function () {
    if (is_admin()) { return; }
    $legacy = content_url('/plugins/bds-craftsmanship-hero/assets/');
    wp_enqueue_style('bds-performance-hero-style', $legacy . 'hero.css', array(), '1.0.2');
    wp_enqueue_script('bds-performance-hero-script', plugin_dir_url(__FILE__) . 'hero.js', array(), '1.4.4', true);
    wp_script_add_data('bds-performance-hero-script', 'strategy', 'defer');
    wp_add_inline_script('bds-performance-hero-script', 'window.BDS_CRAFTSMANSHIP_HERO=' . wp_json_encode(array('video' => $legacy . 'craftsmanship.mp4', 'poster' => $legacy . 'craftsmanship-poster.webp')) . ';', 'before');
});

// Keep the exact app CSS in document order, without a separate blocking request.
add_action('wp_enqueue_scripts', function () {
    if (is_admin()) { return; }
    $styles = wp_styles();
    foreach ($styles->registered as $handle => $item) {
        if (!is_string($item->src)) { continue; }
        $path = wp_parse_url($item->src, PHP_URL_PATH);
        if (!$path) { continue; }
        $app_css = str_contains($path, '/plugins/bds-site-performance-patch-restored/build/static/css/') || str_contains($path, '/plugins/bds-marvel-app/build/static/css/') || str_contains($path, '/plugins/bds-site-performance-patch/build/static/css/') || str_ends_with($path, '/themes/bds-marvel-theme/style.css');
        $small_plugin_css = !empty($GLOBALS['bds_prerendering']) && str_contains($path, '/plugins/') && str_ends_with($path, '.css');
        if (!$app_css && !$small_plugin_css) { continue; }
        $content_path = wp_parse_url(content_url(), PHP_URL_PATH);
        if (strpos($path, $content_path . '/') !== 0) { continue; }
        $file = realpath(WP_CONTENT_DIR . substr($path, strlen($content_path)));
        if (!$file || !is_readable($file)) { continue; }
        $allowed_file = str_starts_with($file, realpath(WP_CONTENT_DIR) . DIRECTORY_SEPARATOR);
        // WordPress.com mounts these public plugin assets outside wp-content.
        foreach (array('jetpack', 'gravatar-enhanced') as $shared_plugin) {
            $shared_prefix = $content_path . '/plugins/' . $shared_plugin . '/';
            $shared_root = realpath(WP_PLUGIN_DIR . '/' . $shared_plugin);
            if ($shared_root && str_starts_with($path, $shared_prefix) && str_starts_with($file, $shared_root . DIRECTORY_SEPARATOR)) { $allowed_file = true; }
        }
        if (!$allowed_file) { continue; }
        if (!$app_css && filesize($file) > 65536) { continue; }
        $css = bds_homepage_initial_styles(file_get_contents($file));
        if (!$css || stripos($css, '@import') !== false) { continue; }
        $base = content_url(dirname(substr($path, strlen($content_path))) . '/');
        $css = preg_replace_callback('~url\\(\\s*([\x22\x27]?)(.*?)\\1\\s*\\)~is', function ($match) use ($base) {
            $url = trim($match[2]);
            if ($url === '' || preg_match('~^(?:[a-z][a-z0-9+.-]*:|/|#)~i', $url)) { return $match[0]; }
            return 'url(' . $match[1] . $base . $url . $match[1] . ')';
        }, $css);
        $after = $styles->get_data($handle, 'after');
        $styles->add_data($handle, 'after', array_merge(array($css), is_array($after) ? $after : array()));
        $item->src = false;
    }
}, 999);

// Keep the original mobile entry and dependencies; redirect only desktop's App import.
add_action('wp_head', function () {
    if (is_admin() || !bds_performance_candidate_request()) { return; }
    $base = plugin_dir_url(__FILE__) . 'candidate/static/chunks/';
    $map = array('imports' => array($base . 'App-6TAOFSWH.js' => $base . 'App-desktop-v162.js'));
    echo '<script id="bds-desktop-import-map">if(window.matchMedia("(min-width: 801px)").matches){var bdsDesktopMap=document.createElement("script");bdsDesktopMap.type="importmap";bdsDesktopMap.textContent=' . wp_json_encode(wp_json_encode($map)) . ';document.head.appendChild(bdsDesktopMap);}</script>';
}, 0);
add_action('wp_head', function () {
    if (is_admin() || !bds_performance_candidate_request()) { return; }
    $base = plugin_dir_url(__FILE__) . 'candidate/static/chunks/';
    $map = array('imports' => array($base . 'App-6TAOFSWH.js' => $base . 'App-mobile-v170.js'));
    echo '<script id="bds-mobile-import-map">if(window.matchMedia("(max-width: 800px)").matches){var bdsMobileMap=document.createElement("script");bdsMobileMap.type="importmap";bdsMobileMap.textContent=' . wp_json_encode(wp_json_encode($map)) . ';document.head.appendChild(bdsMobileMap);}</script>';
}, 0);

add_filter('script_module_loader_src' , function ($src, $id) {
    if ($id !== 'bdsm-app-module' || is_admin()) { return $src; }
    if (bds_performance_candidate_request()) { return plugin_dir_url(__FILE__) . 'candidate/static/js/main.G7LVMAIA.js'; }
    return plugin_dir_url(__FILE__) . 'build/static/js/main.OUTMXCIV.js';
}, 10, 2);

add_action('wp_head', function () {
    if (!empty($GLOBALS['bds_prerendering']) || bds_performance_candidate_request()) { return; }
    $base = plugin_dir_url(__FILE__) . 'build/';
    $modules = array('static/chunks/App-TLKETZZ5.js','static/chunks/chunk-CQE43DUT.js','static/chunks/chunk-M6DIYUPB.js','static/chunks/chunk-PW7PRUPU.js','static/chunks/chunk-U4PMZPVC.js','static/chunks/chunk-WFYBJGME.js','static/chunks/chunk-YSSUSFUN.js','static/chunks/chunk-ZRQ3SJSA.js','static/js/main.OUTMXCIV.js');
    foreach ($modules as $module) {
        echo '<link rel="modulepreload" href="' . esc_url($base . $module) . '">' . "\n";
    }
}, 1);
add_action('wp_enqueue_scripts', function () {
    if (is_admin()) { return; }
    foreach (array('wp-hooks', 'wp-i18n', 'wp-jp-i18n-loader', 'wp-url', 'jetpack-instant-search', 'jp-tracks') as $handle) {
        if (wp_script_is($handle, 'registered')) { wp_script_add_data($handle, 'strategy', 'defer'); }
    }
}, 1000);

add_action('wp_enqueue_scripts', function () {
    if (is_admin()) { return; }
    $styles = wp_styles();
    if (!isset($styles->registered['bdsm-app-fonts'])) { return; }
    $styles->registered['bdsm-app-fonts']->src = false;
    wp_add_inline_style('bdsm-app-fonts', <<<'BDS_FONT_RULES'
/* latin-ext */
@font-face {
  font-family: 'DM Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.wp.com/s/dmmono/v16/aFTU7PB1QTsUX8KYthSQBK6PYK3EXw.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'DM Mono';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.wp.com/s/dmmono/v16/aFTU7PB1QTsUX8KYthqQBK6PYK0.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'DM Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(https://fonts.wp.com/s/dmmono/v16/aFTR7PB1QTsUX8KYvumzEY2tbYf-Vlh3uA.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'DM Mono';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(https://fonts.wp.com/s/dmmono/v16/aFTR7PB1QTsUX8KYvumzEYOtbYf-Vlg.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJuktqUYLkn8BJ.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJuktqUYLkn8BJ.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJuktqUYLkn8BJ.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJuktqUYLkn8BJ.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJuktqUYLkn8BJ.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJuktqUYLkn8BJ.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Outfit';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url(https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

BDS_FONT_RULES
    );
}, 1001);
add_action('wp_head', function () {
    echo '<link rel="preload" as="font" type="font/woff2" href="https://fonts.wp.com/s/dmmono/v16/aFTR7PB1QTsUX8KYvumzEYOtbYf-Vlg.woff2" crossorigin>';
    echo '<link rel="preload" as="font" type="font/woff2" href="https://fonts.wp.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtqUYLknw.woff2" crossorigin>';
    echo '<link rel="preload" as="font" type="font/woff2" href="https://fonts.wp.com/s/dmmono/v16/aFTU7PB1QTsUX8KYthqQBK6PYK0.woff2" crossorigin>';
}, 1);


// Keep the homepage's initial configuration limited to data it renders.
// Secondary routes resolve the existing public content endpoint before mounting.
add_action('wp_print_scripts', function () {
    if (is_admin() || !is_front_page()) { return; }
    $request_path = wp_parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $home_path = wp_parse_url(home_url('/'), PHP_URL_PATH);
    if (untrailingslashit($request_path) !== untrailingslashit($home_path)) { return; }
    $scripts = wp_scripts();
    $before = $scripts->get_data('bdsm-app-config', 'before');
    if (!is_array($before)) { return; }
    foreach ($before as $index => $code) {
        if (!preg_match('/^window\.BDS_WORDPRESS\s*=\s*(\{.*\});\s*$/s', trim($code), $match)) { continue; }
        $config = json_decode($match[1], true);
        if (!is_array($config) || !isset($config['content'])) { continue; }
        unset($config['content']['catalogueItems'], $config['content']['catalogueDetails'], $config['content']['serviceExtras']);
        $config['deferredContent'] = true;
        $before[$index] = 'window.BDS_WORDPRESS = ' . wp_json_encode($config) . ';';
    }
    $scripts->add_data('bdsm-app-config', 'before', $before);
}, 0);

// Use a public HTML snapshot only while it matches current WordPress content.
// Retain an explicit rollback URL while enabling the verified LCP path by default.
function bds_lcp_optimized_request() {
    return !isset($_GET['bds_lcp_preview']) || $_GET['bds_lcp_preview'] !== '0';
}

// Content edits, year changes and authenticated sessions retain normal rendering.
add_action('template_redirect', function () {
    if (!is_front_page() || is_user_logged_in() || !function_exists('bds_public_content')) { return; }
    $request_path = wp_parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $home_path = wp_parse_url(home_url('/'), PHP_URL_PATH);
    if (untrailingslashit($request_path) !== untrailingslashit($home_path)) { return; }
    $meta_file = __DIR__ . '/build/homepage-meta.json';
    $html_file = __DIR__ . (bds_performance_candidate_request() ? '/candidate/homepage.html' : '/build/homepage.html');
    if (!is_readable($meta_file) || !is_readable($html_file)) { return; }
    $meta = json_decode(file_get_contents($meta_file), true);
    if (!is_array($meta) || ($meta['year'] ?? '') !== wp_date('Y')) { return; }
    $content_hash = hash('sha256', wp_json_encode(bds_public_content()));

    if (!hash_equals($meta['content_sha256'] ?? '', $content_hash)) { return; }
    $homepage = file_get_contents($html_file);

    // Keep the prerendered hero poster stable for LCP. The existing footer
    // starts the decorative video after the visitor interacts.
    $homepage = preg_replace_callback('~<video\b[^>]*\bsrc="[^"]*craftsmanship\.mp4"[^>]*></video>~i', function ($match) {
        $video = str_replace('preload="auto"', 'preload="none"', $match[0]);
        // The existing high-priority image supplies the initial hero visual.
        // Avoid asking the video element to paint the same poster a second time.
        return preg_replace('~\bsrc="([^"]*)"~', 'data-bds-video-src="$1"', $video, 1);
    }, $homepage);
    if (bds_lcp_optimized_request()) {
        $homepage = preg_replace_callback('~<img\b[^>]*class="[^"]*bds-craftsmanship-poster[^"]*"[^>]*>~i', function ($match) {
            $mobile_file = __DIR__ . '/assets/hero-poster-mobile.webp';
            if (!is_readable($mobile_file)) { return $match[0]; }
            $srcset = plugin_dir_url(__FILE__) . 'assets/hero-poster-mobile.webp 1200w, https://bdsmarvel.com/wp-content/plugins/bds-craftsmanship-hero/assets/craftsmanship-poster.webp 1920w';
            return preg_replace('~<img\b~i', '<img srcset="' . esc_attr($srcset) . '" sizes="(max-width: 800px) 100vw, 1920px"', $match[0], 1);
        }, $homepage, 1);
        // This first service image is visible in the mobile initial viewport.
        // Do not wait for lazy-image scheduling to discover an LCP candidate.
        $homepage = preg_replace_callback('~<img\b[^>]*class="[^"]*network-panel__mascot[^"]*"[^>]*>~i', function ($match) {
            $image = preg_replace('~\bloading="lazy"~', 'loading="eager"', $match[0]);
            if (stripos($image, 'fetchpriority=') === false) {
                $image = preg_replace('~<img\b~i', '<img fetchpriority="high"', $image, 1);
            }
            return $image;
        }, $homepage, 1);
    }
    if (!$homepage) { return; }
    $GLOBALS['bds_prerendering'] = true;
    ob_start(function ($html) use ($homepage) {
        $html = str_replace('id="bdsm-app-module-js-module"', 'id="bdsm-app-module-js-module" fetchpriority="low"', $html);
        if (bds_lcp_optimized_request()) {
            $html = preg_replace_callback('~<link\b[^>]*>~i', function ($match) {
                if (strpos($match[0], '/craftsmanship-poster.webp') === false || strpos($match[0], 'as="image"') === false) { return $match[0]; }
                return str_replace('<link ', '<link media="(min-width: 801px)" ', $match[0]);
            }, $html);
        }
        return str_replace('<div id="bdsm-marvel-root"></div>', '<div id="bdsm-marvel-root" data-bds-prerendered="true">' . $homepage . '</div>', $html);
    });
}, 0);

add_action('wp_head', function () {
    ?>
<script>document.addEventListener('play',function(e){if(e.target.matches&&e.target.matches('.bds-craftsmanship-media video')&&matchMedia('(prefers-reduced-motion: reduce)').matches)e.target.pause()},true);</script>
<?php
}, 0);

// Start native playback after the poster paints, without waiting for the app bundle.
add_action('wp_footer', function () {
    if (empty($GLOBALS['bds_prerendering'])) { return; }
    ?>
<script id="bds-native-hero-start">(()=>{function start(){const video=document.querySelector('.bds-craftsmanship-media video'),poster=document.querySelector('.bds-craftsmanship-poster');if(!video||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const ready=poster&&poster.decode?poster.decode().catch(()=>{}):Promise.resolve();ready.then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(video.isConnected&&!matchMedia('(prefers-reduced-motion: reduce)').matches)video.play().catch(()=>{})})));}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start()})();</script>
<?php
}, 1);

// Keep the decorative contact accent readable against its pale background.
add_action('wp_head', function () {
    if (is_admin()) { return; }
    echo '<style id="bds-contact-contrast">.zoo-site .contact-section .contact-orbit em{color:#665127!important}</style>';
}, 1002);

// These small, self-contained WordPress libraries otherwise add three requests
// to the homepage's critical chain. Preserve their registered dependency order
// and inline configuration; read the currently installed vendor files.
add_action('wp_enqueue_scripts', function () {
    if (empty($GLOBALS['bds_prerendering']) || is_admin()) { return; }
    $scripts = wp_scripts();
    $content_path = wp_parse_url(content_url(), PHP_URL_PATH);
    $roots = array_filter(array(realpath(WP_CONTENT_DIR), realpath(WP_PLUGIN_DIR . '/gutenberg'), realpath(WPMU_PLUGIN_DIR . '/wpcomsh')));
    foreach (array('wp-hooks', 'wp-i18n', 'wp-jp-i18n-loader') as $handle) {
        $item = $scripts->registered[$handle] ?? null;
        if (!$item || !is_string($item->src)) { continue; }
        $path = wp_parse_url($item->src, PHP_URL_PATH);
        if (!$path || !str_starts_with($path, $content_path . '/')) { continue; }
        $file = realpath(WP_CONTENT_DIR . substr($path, strlen($content_path)));
        if (!$file || !is_readable($file) || filesize($file) > 32768) { continue; }
        $allowed = false;
        foreach ($roots as $root) { if (str_starts_with($file, $root . DIRECTORY_SEPARATOR)) { $allowed = true; break; } }
        if (!$allowed) { continue; }
        $code = file_get_contents($file);
        if (!$code || stripos($code, '</script') !== false) { continue; }
        wp_add_inline_script($handle, $code, 'before');
        $item->src = false;
    }
}, 1001);
add_filter('wp_resource_hints', function ($urls, $relation) {
    if ($relation !== 'preconnect' || empty($GLOBALS['bds_prerendering'])) { return $urls; }
    $urls = array_values(array_filter($urls, function ($entry) {
        $url = is_array($entry) ? ($entry['href'] ?? '') : $entry;
        return !in_array(wp_parse_url($url, PHP_URL_HOST), array('i0.wp.com', 'c0.wp.com'), true);
    }));
    $urls[] = 'https://images.unsplash.com';
    $urls[] = array('href' => 'https://fonts.wp.com', 'crossorigin' => 'anonymous');
    return $urls;
}, 20, 2);

// Use the minified production stylesheet generated from bundled routes only.
add_action('wp_enqueue_scripts', function () {
    if (is_admin()) { return; }
    foreach (wp_styles()->registered as $item) {
        if (is_string($item->src) && str_contains($item->src, '/plugins/bds-marvel-app/build/static/css/')) {
            $item->src = plugin_dir_url(__FILE__) . 'build/static/css/main.81e3af6d7722.css';
        }
    }
}, 998);

// The custom homepage has no open WordPress search overlay. Initialize that
// optional UI on demand; search result pages retain normal eager initialization.
add_filter('script_loader_tag', function ($tag, $handle) {
    if (!in_array($handle, array('jetpack-instant-search', 'jp-tracks'), true) || empty($GLOBALS['bds_prerendering']) || is_search() || get_query_var('s')) { return $tag; }
    if ($handle === 'jp-tracks') {
        // Leave Tracks eager if another queued plugin explicitly needs it.
        $scripts = wp_scripts();
        foreach ($scripts->queue as $queued) {
            if ($queued !== 'jetpack-instant-search' && in_array('jp-tracks', $scripts->registered[$queued]->deps ?? array(), true)) { return $tag; }
        }
    }
    return str_replace(' src=', ' data-bds-search-src=', $tag);
}, 20, 2);
add_action('wp_footer', function () {
    if (empty($GLOBALS['bds_prerendering']) || is_search() || get_query_var('s')) { return; }
    ?>
<script id="bds-search-on-demand">(()=>{const selector='form[role="search"],input[type="search"],input[name="s"],.search-toggle,.jetpack-search-button,a[href="#search"],a[href*="?s="]';let pending;function load(placeholder){if(!placeholder)return Promise.resolve();return new Promise((resolve,reject)=>{const script=document.createElement('script');for(const attr of placeholder.attributes){if(attr.name!=='data-bds-search-src')script.setAttribute(attr.name,attr.value)}script.src=placeholder.getAttribute('data-bds-search-src');script.async=true;script.onload=resolve;script.onerror=()=>{script.replaceWith(placeholder);reject(new Error('Search resource failed'))};placeholder.replaceWith(script)})}function start(){if(pending)return;if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',start,{once:true});return}const tracks=document.querySelector('#jp-tracks-js[data-bds-search-src]'),search=document.querySelector('#jetpack-instant-search-js[data-bds-search-src]');if(!tracks&&!search)return;pending=load(tracks).then(()=>load(search)).catch(()=>{pending=null})}function detect(event){if(event.target instanceof Element&&event.target.closest(selector))start()}for(const event of ['pointerover','pointerdown','focusin','submit'])document.addEventListener(event,detect,true);document.addEventListener('keydown',event=>{if(event.key==='/'&&event.target instanceof Element&&!event.target.closest('input,textarea,[contenteditable="true"]'))start()});if(new URLSearchParams(location.search).has('s')||location.hash==='#search')start()})();</script>
<?php
}, 1002);





add_action('wp_footer', function () {
    if (empty($GLOBALS['bds_prerendering'])) { return; }
    ?>
<script id="bds-lazy-hero-video">(()=>{const video=document.querySelector('.bds-craftsmanship-media video');if(!video)return;let started=false;const start=()=>{if(started||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const src=video.dataset.bdsVideoSrc;if(!src)return;started=true;video.src=src;video.load();video.play().catch(()=>{});};for(const event of ['pointerdown','keydown'])document.addEventListener(event,start,{once:true,passive:true});})();</script>
<?php
}, 2);

// Split homepage styles from secondary-page styles. Fall back to the complete
// stylesheet whenever the app CSS changes.
function bds_homepage_initial_styles($css) {
    if (empty($GLOBALS['bds_prerendering']) && (!isset($_GET['bds_css_preview']) || $_GET['bds_css_preview'] !== '1')) { return $css; }
    $path = wp_parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    if (untrailingslashit($path) !== untrailingslashit(wp_parse_url(home_url('/'), PHP_URL_PATH))) { return $css; }
    if (!is_string($css) || !hash_equals('4957d60d791b8603f541f77def826c1ca59812b6fd8fb24ccb58709729f722a3', hash('sha256', $css))) { return $css; }
    if (!function_exists('gzdecode')) { return $css; }
    $map = json_decode(gzdecode(base64_decode('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')), true);
    if (!is_array($map)) { return $css; }
    $initial = preg_replace_callback('~([^{}]+)\{([^{}]*)\}~', function ($match) use ($map) {
        $selector = trim($match[1]);
        if (!array_key_exists($selector, $map)) { return $match[0]; }
        return $map[$selector] === '' ? '' : $map[$selector] . '{' . $match[2] . '}';
    }, $css);
    return is_string($initial) && $initial !== '' ? '/* bds-homepage-css-v1 */' . $initial : $css;
}
add_action('wp_head', function () {
    if (is_admin()) { return; }
    ?>
<script id="bds-secondary-styles-on-demand">(()=>{let ready=false,pending;const initial=()=>document.getElementById('bdsm-app-css-0-inline-css')?.textContent.includes('bds-homepage-css-v1');function load(){if(ready)return Promise.resolve();if(pending)return pending;pending=new Promise(resolve=>{const link=document.createElement('link');link.rel='stylesheet';link.href='https://bdsmarvel.com/wp-content/plugins/bds-site-performance-patch-restored/build/static/css/main.81e3af6d7722.css';link.id='bds-secondary-full-css';link.onload=()=>{ready=true;resolve()};link.onerror=()=>{link.remove();pending=null;resolve()};document.head.appendChild(link)});return pending}function control(event){return event.target instanceof Element?event.target.closest('#bdsm-marvel-root a,#bdsm-marvel-root button'):null}function warm(event){if(initial()&&control(event))load()}for(const name of ['pointerover','pointerdown','focusin'])document.addEventListener(name,warm,{capture:true,passive:true});document.addEventListener('click',event=>{const target=control(event);if(!target||ready||!initial()||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const anchor=target.closest('a');if(anchor&&(anchor.origin!==location.origin||anchor.target==='_blank'||anchor.hasAttribute('download')))return;event.preventDefault();event.stopImmediatePropagation();load().then(()=>{if(!ready){ready=true}if(target.isConnected)target.click()})},true)})();</script>
<?php
}, 0);

// Paint mobile LCP content in its final position instead of waiting for entry motion.
add_action('wp_head', function () {
    if (empty($GLOBALS['bds_prerendering']) || !bds_lcp_optimized_request()) { return; }
    echo '<style id="bds-mobile-lcp-first-paint">@media(max-width:800px){#bdsm-marvel-root[data-bds-prerendered]>.route-shell:has(#top){animation:none!important}#bdsm-marvel-root #top .hero-line__inner,#bdsm-marvel-root #top .eyebrow,#bdsm-marvel-root #top .hero-footer{animation:none!important;transform:none!important}}</style>';
}, 1003);



// Mobile keeps the explicit optimized image above the native video poster.
add_action('wp_head', function () {
    if (empty($GLOBALS['bds_prerendering'])) { return; }
    echo '<style id="bds-mobile-video-first-paint">@media(max-width:800px){#top .bds-craftsmanship-media:not([data-bds-mobile-video-ready]) video{visibility:hidden}#top .bds-craftsmanship-media:not([data-bds-mobile-video-ready]) .bds-craftsmanship-poster{z-index:2!important}}</style>';
}, 1004);
add_action('wp_footer', function () {
    if (empty($GLOBALS['bds_prerendering'])) { return; }
    ?>
<script id="bds-mobile-video-visibility">(()=>{if(!matchMedia('(max-width:800px)').matches)return;let interacted=false;function reveal(video){if(interacted&&video.matches?.('.bds-craftsmanship-media video')&&video.readyState>=2)video.parentElement.setAttribute('data-bds-mobile-video-ready','true')}function start(){interacted=true;const video=document.querySelector('.bds-craftsmanship-media video');if(video)reveal(video)}document.addEventListener('loadeddata',event=>reveal(event.target),true);for(const event of ['pointerdown','keydown'])document.addEventListener(event,start,{once:true,passive:true})})();</script>
<?php
}, 3);

add_action('wp_head', function () {
    if (empty($GLOBALS['bds_prerendering'])) { return; }
    echo '<link rel="preload" as="image" media="(max-width:800px)" fetchpriority="high" href="' . esc_url(plugin_dir_url(__FILE__) . 'assets/hero-poster-mobile.webp') . '">';
}, -1);
