"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Publishes the page scroll as `--p` (px, 0..700) on its element. Layers inside use
 * `.hv-par` (transform: translateY(--p * --k)) to drift at different speeds. One rAF-throttled
 * passive listener, transform only; does nothing for reduced motion.
 */
export function ParallaxRoot({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty("--p", String(Math.min(700, Math.max(0, window.scrollY))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={ref}>{children}</div>;
}
