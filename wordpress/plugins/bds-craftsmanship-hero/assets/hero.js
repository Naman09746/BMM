(() => {
  'use strict';
  const assets = window.BDS_CRAFTSMANSHIP_HERO;
  if (!assets) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let activeVideo;
  let videoReady = false;
  function syncMotion() {
    if (!activeVideo) return;
    if (reduced.matches) activeVideo.pause();
    else if (videoReady) activeVideo.play().catch(() => {});
  }
  function enhanceImages(root) {
    root.querySelectorAll('img[src*="images.unsplash.com"]:not([data-bds-responsive])').forEach(img => {
      try {
        const url = new URL(img.currentSrc || img.src, location.href);
        if (url.hostname !== 'images.unsplash.com') return;
        const isNetwork = img.classList.contains('network-panel__mascot');
        const isWork = img.closest('.work-slideshow');
        const max = isWork ? 1440 : (isNetwork ? 1000 : 1200);
        const sizes = isWork ? '(max-width: 700px) 100vw, 1146px' : (isNetwork ? '(max-width: 700px) 90vw, 710px' : '(max-width: 700px) 90vw, 900px');
        const widths = [...new Set([400, 640, 800, 1000, 1200, 1440].filter(width => width <= max).concat(max))].sort((a,b) => a-b);
        const urlFor = width => { const candidate = new URL(url.href); candidate.searchParams.set('auto', 'format'); candidate.searchParams.set('fit', 'crop'); candidate.searchParams.set('q', '72'); candidate.searchParams.set('w', String(width)); return candidate.href; };
        img.sizes = sizes;
        img.srcset = widths.map(width => urlFor(width) + ' ' + width + 'w').join(', ');
        img.src = urlFor(max);
        img.decoding = 'async';
        if (img.getBoundingClientRect().top > window.innerHeight * 1.5) img.loading = 'lazy';
        img.dataset.bdsResponsive = 'true';
      } catch (_) {}
    });
  }
  function enhanceAccessibility(root) {
    root.querySelectorAll('.purpose-arrows button').forEach((button, index) => {
      if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', index % 2 ? 'Next purpose' : 'Previous purpose');
    });
    root.querySelectorAll('article.network-panel').forEach(panel => {
      const heading = panel.querySelector('h3');
      if (heading) { heading.setAttribute('role', 'heading'); heading.setAttribute('aria-level', '2'); }
      const label = heading?.textContent.trim();
      if (label) panel.querySelectorAll('a').forEach(link => {
        if (/^explore$/i.test(link.textContent.trim())) link.setAttribute('aria-label', 'Explore ' + label);
      });
    });
  }
  function enhance() {
    if (activeVideo && !activeVideo.isConnected) {
      activeVideo.pause();
      activeVideo.removeAttribute('src');
      activeVideo.load();
      activeVideo = null;
      videoReady = false;
    }
    const root = document.getElementById('bdsm-marvel-root');
    if (!root) return;
    enhanceImages(root);
    enhanceAccessibility(root);
    const hero = root.querySelector('.hero[data-testid="hero-section"]');
    if (!hero || hero.querySelector('.bds-craftsmanship-media')) return;
    hero.classList.add('bds-craftsmanship-hero');
    const media = document.createElement('div');
    media.className = 'bds-craftsmanship-media';
    media.setAttribute('aria-hidden', 'true');
    const video = document.createElement('video');
    video.muted = true; video.defaultMuted = true; video.loop = true;
    video.playsInline = true; video.autoplay = !reduced.matches; video.preload = 'none';
    video.poster = assets.poster; video.setAttribute('muted', ''); video.setAttribute('playsinline', ''); video.tabIndex = -1;
    media.appendChild(video); hero.prepend(media); activeVideo = video;
    const startVideo = () => {
      if (!activeVideo || reduced.matches) return;
      videoReady = true; video.src = assets.video; video.load(); syncMotion();
    };
    const deferVideo = () => {
      if ('requestIdleCallback' in window) requestIdleCallback(startVideo, {timeout: 3000});
      else setTimeout(startVideo, 1500);
    };
    if (document.readyState === 'complete') deferVideo();
    else window.addEventListener('load', deferVideo, {once: true});
    syncMotion();
  }
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; enhance(); });
  });
  function init() {
    const root = document.getElementById('bdsm-marvel-root');
    if (!root) return;
    observer.observe(root, {childList: true, subtree: true}); enhance();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
  reduced.addEventListener('change', syncMotion);
})();
