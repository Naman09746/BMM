<?php
if (!defined('ABSPATH')) { exit; }

/** SEO metadata and crawler resources for the React app routes. */
function bds_seo_path() {
    $path = wp_parse_url(isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '/', PHP_URL_PATH);
    $base = wp_parse_url(home_url('/'), PHP_URL_PATH);
    if ($base && $base !== '/' && strpos($path, $base) === 0) { $path = substr($path, strlen($base)); }
    return trim((string) $path, '/');
}
function bds_seo_text($value) {
    if (is_array($value)) { $value = implode(' ', array_filter($value, 'is_string')); }
    return trim(wp_strip_all_tags((string) $value));
}
function bds_seo_route() {
    $path = bds_seo_path();
    $parts = $path === '' ? array() : explode('/', $path);
    $route = array('path' => $path, 'parts' => $parts, 'title' => 'BDS Marvel | Marble, Flooring, Construction & Interiors',
        'description' => 'One design and build studio for marble and stone, flooring, turnkey construction and interior design, with workshops and studios across India.', 'type' => 'WebPage', 'image' => '');
    $static = array(
        '' => array('BDS Marvel | Marble, Flooring, Construction & Interiors', 'One design and build studio for marble and stone, flooring, turnkey construction and interior design — with workshops and studios across India.', 'WebSite'),
        'projects' => array('Projects | BDS Marvel', 'Residential, hospitality, commercial and civic projects in stone, flooring, construction and interiors, delivered across India by one in-house team.', 'CollectionPage'),
        'catalogue' => array('Materials Catalogue | BDS Marvel', 'Browse the BDS Marvel material library for marble and stone, flooring, furniture and finishes.', 'CollectionPage'),
        'businesses' => array('Our Services | BDS Marvel', 'Explore BDS Marvel services in marble and stone, flooring, turnkey construction, interior design and bespoke furniture.', 'CollectionPage'),
        'about' => array('About BDS Marvel | One Design & Build Studio', 'Meet BDS Marvel, one design and build company for stone, flooring, construction and interiors, with teams across India.', 'AboutPage'),
        'contact' => array('Contact BDS Marvel | Studios Across India', 'Talk to BDS Marvel about a project. Find our studios and workshops in Mumbai, Kishangarh, Gurugram, Pune, New Delhi and Goa.', 'ContactPage'),
        'stays' => array('Stays & BnBs | BDS Marvel', 'Explore BDS Marvel design stays and BnBs across India, check availability and book a stay directly.', 'CollectionPage'),
        'experience' => array('The BDS Marvel Living Studio | Design Stay', 'Stay inside a working BDS Marvel home and experience suites built with our own stone, flooring, finishes and furniture.', 'WebPage'),
    );
    if (isset($static[$path])) { $route['title']=$static[$path][0];$route['description']=$static[$path][1];$route['type']=$static[$path][2]; }
    $single = array('projects'=>'bds_project','catalogue'=>'bds_collection','businesses'=>'bds_service');
    if (count($parts) >= 2 && isset($single[$parts[0]])) {
        $post = get_page_by_path(sanitize_title($parts[1]), OBJECT, $single[$parts[0]]);
        if ($post && $post->post_status === 'publish') {
            $data = json_decode(get_post_meta($post->ID, '_bds_fields', true), true) ?: array();
            $summary = $data['description'] ?? $data['desc'] ?? $data['headline'] ?? '';
            if ($parts[0] === 'businesses') {
                $seo = $data['seo'] ?? array();
                if (is_array($seo) && count($seo) >= 2) { $route['title']=bds_seo_text($seo[0]);$summary=$seo[1]; }
            }
            if ($parts[0] === 'catalogue' && count($parts) >= 3) {
                $products = $data['detail']['products'] ?? array(); $index = max(0, (int)$parts[2]-1);
                if (isset($products[$index]) && is_array($products[$index])) {
                    $route['title']=bds_seo_text(($products[$index]['name'] ?? 'Material') . ' | ' . $post->post_title . ' | BDS Marvel');
                    $summary=($products[$index]['material'] ?? '') . ' ' . ($products[$index]['finish'] ?? '') . ' ' . ($products[$index]['use'] ?? '');
                }
            } elseif ($route['title'] === 'BDS Marvel | Marble, Flooring, Construction & Interiors' || $parts[0] !== 'businesses') {
                $route['title']=bds_seo_text($post->post_title . ' | ' . ucfirst($parts[0]) . ' | BDS Marvel');
            }
            $route['description']=bds_seo_text($summary) ?: $route['description'];
            $route['type']=$parts[0] === 'projects' ? 'CreativeWork' : ($parts[0] === 'catalogue' ? (count($parts) >= 3 ? 'Product' : 'CollectionPage') : 'Service');
            $route['image']=get_the_post_thumbnail_url($post, 'full') ?: '';
        }
    } elseif (count($parts) >= 3 && $parts[0] === 'stays' && $parts[1] === 'home') {
        $post = get_page_by_path(sanitize_title($parts[2]), OBJECT, 'bds_stay');
        if ($post && $post->post_status === 'publish') {
            $data=json_decode(get_post_meta($post->ID,'_bds_fields',true),true)?:array();
            $route['title']=bds_seo_text($post->post_title . ' | Design Stay | BDS Marvel');
            $route['description']=bds_seo_text($data['description'] ?? $data['summary'] ?? 'Check availability and book ' . $post->post_title . ', a BDS Marvel design stay.');
            $route['type']='LodgingBusiness';$route['image']=get_the_post_thumbnail_url($post,'full')?:'';
        }
    } elseif (count($parts) >= 2 && $parts[0] === 'stays') {
        $route['title']=ucfirst(str_replace('-', ' ', $parts[1])) . ' Stays | BDS Marvel';
        $route['description']='Explore ' . strtolower(str_replace('-', ' ', $parts[1])) . ' design stays from BDS Marvel. View each home, check dates and book directly.';
        $route['type']='CollectionPage';
    }
    $route['canonical']=home_url($path === '' ? '/' : trailingslashit($path));
    return $route;
}
function bds_seo_is_app_route() { return !is_admin() && (is_front_page() || (function_exists('get_query_var') && get_query_var('bds_app')) || is_singular() && has_shortcode(get_post()->post_content ?? '', 'bds_marvel_app')); }
add_filter('pre_get_document_title', function($title) { return bds_seo_is_app_route() ? bds_seo_route()['title'] : $title; }, 99);
add_filter('jetpack_enable_opengraph', function($enabled) { return bds_seo_is_app_route() ? false : $enabled; });
add_filter('wp_robots', function($robots) {
    if (in_array(bds_seo_path(), array('bds-marvel-preview','2026/09/30/hello-world'), true)) { $robots['noindex']=true;$robots['follow']=true; }
    return $robots;
});
add_action('wp_head', function() {
    if (!bds_seo_is_app_route()) { return; }
    $r=bds_seo_route();$brand='BDS Marvel';$image=$r['image'] ?: get_site_icon_url(512);
    echo "\n<link rel=\"canonical\" href=\"".esc_url($r['canonical'])."\" />\n";
    echo '<link rel="sitemap" type="application/xml" href="'.esc_url(home_url('/bds-sitemap.xml')).'" />' . "\n";
    echo '<meta name="description" content="'.esc_attr($r['description']).'" />' . "\n";
    foreach (array('og:type'=>$r['type'],'og:title'=>$r['title'],'og:description'=>$r['description'],'og:url'=>$r['canonical'],'og:site_name'=>$brand) as $key=>$value) { echo '<meta property="'.esc_attr($key).'" content="'.esc_attr($value).'" />' . "\n"; }
    if ($image) { echo '<meta property="og:image" content="'.esc_url($image).'" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="'.esc_url($image).'" />' . "\n"; }
    echo '<meta name="twitter:title" content="'.esc_attr($r['title']).'" /><meta name="twitter:description" content="'.esc_attr($r['description']).'" />' . "\n";
    $d=bds_content_defaults();$locations=array();
    foreach (($d['cities']??array()) as $city) {
        $address=preg_replace('/^[^·]+·\s*/u','',(string)($city['address']??''));
        $locations[]=array('@type'=>'Place','name'=>($city['brand']??$brand).' — '.($city['city']??''),'address'=>array('@type'=>'PostalAddress','streetAddress'=>$address,'addressCountry'=>'IN','addressRegion'=>($city['city']??'')==='Kishangarh'?'Rajasthan':(($city['city']??'')==='Goa'?'Goa':(($city['city']??'')==='Mumbai'?'Maharashtra':(($city['city']??'')==='Pune'?'Maharashtra':(($city['city']??'')==='Gurugram'?'Haryana':'Delhi')))),'addressLocality'=>$city['city']??''));
    }
    $graph=array('@context'=>'https://schema.org','@graph'=>array(
        array('@type'=>'Organization','@id'=>home_url('/#organization'),'name'=>'BDS Marvel','alternateName'=>array('BDSM','BDSM · BDS Marvel'),'url'=>home_url('/'),'description'=>'Design and build studio for marble and stone, flooring, turnkey construction, interior design and bespoke furniture.','email'=>'info@bdsmarvel.com','areaServed'=>array('IN'),'knowsAbout'=>array('Marble and stone','Flooring','Turnkey construction','Interior design','Bespoke furniture','Hospitality design'),'location'=>$locations,'sameAs'=>array('https://www.instagram.com/bds.marvel')),
        array('@type'=>$r['type'],'@id'=>$r['canonical'].'#webpage','url'=>$r['canonical'],'name'=>$r['title'],'description'=>$r['description'],'isPartOf'=>array('@id'=>home_url('/#website')),'about'=>array('@id'=>home_url('/#organization')))
    ));
    echo '<script type="application/ld+json">'.wp_json_encode($graph, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE)."</script>\n";
}, 99);
add_filter('robots_txt', function($output) { return rtrim($output)."\nSitemap: ".home_url('/bds-sitemap.xml')."\n"; });
function bds_seo_clean_html($html) {
    if (!bds_seo_is_app_route()) { return $html; }
    $stale=array(
        '~<meta name="description" content="One Dream\\. One Studio\\."\\s*/?>\\s*~i',
        '~<meta property="og:title" content="BDSM"\\s*/?>\\s*~i',
        '~<meta property="og:description" content="One Dream\\. One Studio\\."\\s*/?>\\s*~i',
        '~<meta property="og:url" content="'.preg_quote(home_url('/'),'~').'"\\s*/?>\\s*~i',
    );
    foreach ($stale as $pattern) { $html=preg_replace($pattern,'',$html,1); }
    $html=str_replace('"description":"One Dream. One Studio."','"description":"Design and build studio for marble and stone, flooring, turnkey construction, interior design and bespoke furniture."',$html);
    return $html;
}

function bds_seo_llms_text() {
    $d=bds_content_defaults();$lines=array('# BDS Marvel','', '> BDS Marvel is an India-based design and build studio for marble and stone, flooring, turnkey construction, interior design and bespoke furniture. It also operates design-led short-stay homes.','', '## Main pages','- [Home](https://bdsmarvel.com/)','- [About](https://bdsmarvel.com/about/)','- [Projects](https://bdsmarvel.com/projects/)','- [Material catalogue](https://bdsmarvel.com/catalogue/)','- [Services](https://bdsmarvel.com/businesses/)','- [Stays and BnBs](https://bdsmarvel.com/stays/)','- [Contact](https://bdsmarvel.com/contact/)','', '## Services');
    foreach (bds_content_rows('bds_service') as $item) { $lines[]='- ['.($item['name']??'Service').'](https://bdsmarvel.com/businesses/'.rawurlencode($item['slug']).'/)'; }
    $lines[]='';$lines[]='## Projects';foreach (bds_content_rows('bds_project') as $item) { $lines[]='- ['.($item['title']??'Project').'](https://bdsmarvel.com/projects/'.rawurlencode($item['slug']).'/)'; }
    $lines[]='';$lines[]='## Material catalogue';foreach (bds_content_rows('bds_collection') as $item) { $lines[]='- ['.($item['name']??'Collection').'](https://bdsmarvel.com/catalogue/'.rawurlencode($item['slug']).'/)'; }
    $lines[]='';$lines[]='## Stays';foreach (bds_content_rows('bds_stay') as $item) { $lines[]='- ['.($item['name']??'Stay').'](https://bdsmarvel.com/stays/home/'.rawurlencode($item['slug']).'/)'; }
    $lines[]='';$lines[]='## Locations';foreach (($d['cities']??array()) as $city) { $lines[]='- '.($city['city']??'India').': '.preg_replace('/^[^·]+·\s*/u','',(string)($city['address']??'')); }
    $lines[]='';$lines[]='## Contact';$lines[]='- Email: info@bdsmarvel.com';$lines[]='- [Instagram](https://www.instagram.com/bds.marvel)';return implode("\n",$lines)."\n";
}
function bds_seo_output_sitemap() {
    $urls=array(''=>get_lastpostmodified('GMT'),'about/'=>get_lastpostmodified('GMT'),'projects/'=>get_lastpostmodified('GMT'),'catalogue/'=>get_lastpostmodified('GMT'),'businesses/'=>get_lastpostmodified('GMT'),'stays/'=>get_lastpostmodified('GMT'),'contact/'=>get_lastpostmodified('GMT'));
    foreach (array('bds_project'=>'projects/','bds_collection'=>'catalogue/','bds_service'=>'businesses/','bds_stay'=>'stays/home/') as $type=>$prefix) {
        foreach (get_posts(array('post_type'=>$type,'post_status'=>'publish','numberposts'=>-1)) as $post) { $urls[$prefix.rawurlencode($post->post_name).'/']=$post->post_modified_gmt; }
    }
    status_header(200);header('Content-Type: application/xml; charset=utf-8');echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    foreach ($urls as $path=>$modified) { $last=$modified?gmdate('Y-m-d',strtotime($modified.' UTC')):gmdate('Y-m-d');echo '<url><loc>'.esc_url(home_url($path===''?'/':$path)).'</loc><lastmod>'.esc_html($last).'</lastmod></url>'; }
    echo '</urlset>';
}
add_action('template_redirect',function() {
    $path=trim((string)wp_parse_url(isset($_SERVER['REQUEST_URI'])?wp_unslash($_SERVER['REQUEST_URI']):'/',PHP_URL_PATH),'/');
    if ($path==='sitemap.xml') { bds_seo_output_sitemap();exit; }
}, -1000);
add_action('template_redirect',function() {
    $path=trim((string)wp_parse_url(isset($_SERVER['REQUEST_URI'])?wp_unslash($_SERVER['REQUEST_URI']):'/',PHP_URL_PATH),'/');
    if ($path==='llms.txt') { status_header(200);header('Content-Type: text/plain; charset=utf-8');header('X-Robots-Tag: noindex, follow');echo bds_seo_llms_text();exit; }
    if ($path==='bds-sitemap.xml') {
        bds_seo_output_sitemap();exit;
    }
});
add_action('template_redirect',function() { if (bds_seo_is_app_route()) { ob_start('bds_seo_clean_html'); } }, -1);

/** Helpful server-rendered copy is replaced by React during hydration. */
function bds_seo_fallback_html() {
    $r=bds_seo_route();$links=array('Projects'=>'/projects/','Materials catalogue'=>'/catalogue/','Services'=>'/businesses/','Stays'=>'/stays/','About'=>'/about/','Contact'=>'/contact/');
    $html='<main class="bds-seo-fallback"><h1>'.esc_html($r['title']).'</h1><p>'.esc_html($r['description']).'</p><nav aria-label="Explore BDS Marvel">';
    foreach ($links as $label=>$url) { $html.='<a href="'.esc_url(home_url($url)).'">'.esc_html($label).'</a> '; }
    return $html.'</nav></main>';
}
