import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function HorizontalScrollArea({
  children,
  className = "",
  style = {},
  showArrows = true,
  scrollAmount = 260,
  dark = false,
}) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();

    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    el.addEventListener("scroll", checkScroll, { passive: true });

    // Re-check after images/fonts settle
    const t = setTimeout(checkScroll, 400);

    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", handleResize);
      el.removeEventListener("scroll", checkScroll);
    };
  }, [checkScroll]);

  const handleScrollBy = (offset) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div
      className={`h-scroll-wrap ${dark ? "h-scroll-wrap--dark" : ""} ${className}`}
      style={{ position: "relative", width: "100%", ...style }}
    >
      {/* Left Edge Gradient Fade Effect */}
      <div
        className={`h-scroll-fade h-scroll-fade--left ${canScrollLeft ? "is-visible" : ""}`}
        aria-hidden="true"
      />

      {/* Right Edge Gradient Fade Effect */}
      <div
        className={`h-scroll-fade h-scroll-fade--right ${canScrollRight ? "is-visible" : ""}`}
        aria-hidden="true"
      />

      {/* Floating Left Arrow Affordance */}
      {showArrows && canScrollLeft && (
        <button
          type="button"
          className="h-scroll-arrow h-scroll-arrow--left"
          onClick={() => handleScrollBy(-scrollAmount)}
          aria-label="Scroll left"
          title="Scroll left"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      {/* Floating Right Arrow Affordance */}
      {showArrows && canScrollRight && (
        <button
          type="button"
          className="h-scroll-arrow h-scroll-arrow--right"
          onClick={() => handleScrollBy(scrollAmount)}
          aria-label="Scroll right"
          title="Scroll right"
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Scrollable Content Track */}
      <div ref={scrollRef} className="h-scroll-track">
        {children}
      </div>
    </div>
  );
}

export default HorizontalScrollArea;

