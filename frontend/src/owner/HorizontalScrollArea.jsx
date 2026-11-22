import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const HorizontalScrollArea = forwardRef(function HorizontalScrollArea(
  {
    children,
    className = "",
    style = {},
    showArrows = true,
    scrollAmount = 280,
    dark = false,
    dragToScroll = true,
    wheelToScroll = true,
  },
  ref
) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragInfo = useRef({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    hasMoved: false,
  });

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
  }, []);

  const handleScrollBy = useCallback((offset) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  }, []);

  const scrollToStart = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, []);

  const scrollToEnd = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: "smooth" });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    scrollBy: handleScrollBy,
    scrollToStart,
    scrollToEnd,
    checkScroll,
    getElement: () => scrollRef.current,
  }));

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();

    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    el.addEventListener("scroll", checkScroll, { passive: true });

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => checkScroll());
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
    }

    const t1 = setTimeout(checkScroll, 150);
    const t2 = setTimeout(checkScroll, 500);
    const t3 = setTimeout(checkScroll, 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", handleResize);
      el.removeEventListener("scroll", checkScroll);
      if (ro) ro.disconnect();
    };
  }, [checkScroll]);

  // Mouse Drag to Scroll handlers
  const handleMouseDown = (e) => {
    if (!dragToScroll) return;
    // Don't drag if user clicked an interactive control
    if (e.target.closest("button, input, select, textarea, a, label, [role='button']")) return;
    const el = scrollRef.current;
    if (!el) return;
    dragInfo.current.isDown = true;
    dragInfo.current.startX = e.pageX - el.offsetLeft;
    dragInfo.current.scrollLeft = el.scrollLeft;
    dragInfo.current.hasMoved = false;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!dragInfo.current.isDown || !scrollRef.current) return;
    e.preventDefault();
    const el = scrollRef.current;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - dragInfo.current.startX) * 1.4;
    if (Math.abs(walk) > 4) {
      dragInfo.current.hasMoved = true;
    }
    el.scrollLeft = dragInfo.current.scrollLeft - walk;
  };

  const handleMouseUp = () => {
    dragInfo.current.isDown = false;
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    dragInfo.current.isDown = false;
    setIsDragging(false);
  };

  // Convert mouse wheel vertically into horizontal track scroll
  const handleWheel = (e) => {
    if (!wheelToScroll || !scrollRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && Math.abs(e.deltaY) > 3) {
      scrollRef.current.scrollLeft += e.deltaY;
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
      <div
        ref={scrollRef}
        className="h-scroll-track"
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: isDragging ? "none" : "auto",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        {children}
      </div>
    </div>
  );
});

export default HorizontalScrollArea;
