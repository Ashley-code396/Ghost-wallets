"use client";

import React, { useEffect, useRef, useState } from "react";

export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  // We intentionally do NOT hide content on initial render to avoid FOUC/FOIC.
  // The observer only adds an animation class when the element becomes visible.
  const [didAnimate, setDidAnimate] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    // Use a single-shot observer: when the element intersects, add the animation class
    // and unobserve the element. This avoids toggling visibility on repeated intersections
    // and is resilient to dynamic updates of children.
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // mark that we've triggered the animation; avoid state churn if already set
          setDidAnimate((prev) => prev || true);
          if (el) observer.unobserve(el);
          break;
        }
      }
    }, { threshold: 0.2 });

    observer.observe(el);

    return () => {
      try {
        observer.disconnect();
      } catch (e) {
        // swallow any disconnect errors on unmount
      }
    };
  }, []);

  // Render children always (no hidden class). We only append an additional
  // animation class once the element has entered the viewport. CSS should
  // handle the transition. This prevents layout shift and hydration flicker.
  return (
    <div ref={ref} className={`reveal-root ${didAnimate ? 'reveal-animate' : ''} ${className}`}>
      {children}
    </div>
  );
}
