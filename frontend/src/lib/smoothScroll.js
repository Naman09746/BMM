import Lenis from "lenis";
import Snap from "lenis/snap";

let lenis = null;
let snap = null;
let rafId = null;
let isRunning = false;

function step(time) {
  if (!isRunning || !lenis) return;
  lenis.raf(time);
  rafId = requestAnimationFrame(step);
}

// Automatically pause animation loop when tab is in background to save GPU & memory
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopSmoothScroll();
    } else {
      const isOwner = typeof window !== "undefined" && window.location.pathname.startsWith("/owner");
      if (!isOwner && lenis) {
        startSmoothScroll();
      }
    }
  });
}

// Idempotent — safe to call from any component effect; child effects run before parent ones
export function initSmoothScroll() {
  if (lenis) return { lenis, snap };
  if (typeof window === "undefined") return { lenis: null, snap: null };

  const hasMatchMedia = typeof window.matchMedia === "function";
  const reduced = hasMatchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
  const isOwner = window.location.pathname.startsWith("/owner");

  // Mobile/small viewports, reduced motion, or owner dashboard: native scrolling
  // This completely eliminates Lenis overhead and keeps performance snappy.
  if (reduced || isOwner || (hasMatchMedia && window.matchMedia("(max-width: 900px)").matches)) {
    return { lenis: null, snap: null };
  }

  // Clearly-sideways gestures over [data-hscroll] rows scroll the row natively; everything else scrolls the page.
  const virtualScroll = ({ deltaX, deltaY, event }) => {
    if (event?.target?.closest?.("[data-lenis-prevent], .cm-modal, .cm-modal-overlay, [role='dialog'], [aria-modal='true']")) return false;
    return !(Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && event.target?.closest?.("[data-hscroll]"));
  };

  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, virtualScroll });
  snap = new Snap(lenis, { type: "proximity", duration: 1, debounce: 250 });

  isRunning = true;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(step);

  window.__smoothScroll = { lenis, snap };
  return { lenis, snap };
}

export function stopSmoothScroll() {
  if (isRunning) {
    isRunning = false;
    cancelAnimationFrame(rafId);
    if (lenis) lenis.stop();
  }
}

export function startSmoothScroll() {
  if (lenis && !isRunning) {
    isRunning = true;
    lenis.start();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(step);
  }
}

export function destroySmoothScroll() {
  stopSmoothScroll();
  if (snap) {
    try { snap.destroy(); } catch (_) {}
    snap = null;
  }
  if (lenis) {
    try { lenis.destroy(); } catch (_) {}
    lenis = null;
  }
  window.__smoothScroll = null;
}

export function smoothScrollTo(target, options = {}) {
  if (lenis) {
    const { onComplete, ...rest } = options;
    // Stop snap during programmatic glides: a queued proximity snap (from the last
    // wheel/touch flick) would otherwise hijack the animation and land on the
    // nearest panel instead of the requested target (e.g. "To the Top" -> footer).
    if (snap) snap.stop();
    lenis.scrollTo(target == null ? 0 : target, {
      duration: 1.2,
      lock: true,
      ...rest,
      onComplete: (...args) => {
        if (snap) snap.start();
        if (onComplete) onComplete(...args);
      },
    });
    return;
  }
  if (target == null) return;
  const behavior = options.immediate ? "instant" : "smooth";
  if (typeof target === "number") window.scrollTo({ top: target, left: 0, behavior });
  else target.scrollIntoView({ behavior, block: "start" });
}
