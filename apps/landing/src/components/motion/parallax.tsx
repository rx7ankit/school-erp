"use client";

import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { prefersReducedMotion } from "./use-trigger";
import { subscribeScroll } from "./scroll-bus";

export type ParallaxProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /**
   * Drift as a fraction of scroll. Positive lags behind the page (feels further away), negative runs ahead
   * (feels closer). 0.06 to 0.15 reads as subtle depth. Default 0.08.
   */
  speed?: number;
  /**
   * "center" (default): 0 offset when the element is centred in the viewport, good for sections further down.
   * "top": offset = scrollY * speed, so the element rests exactly in place at scroll 0 (use it for the hero).
   */
  origin?: "center" | "top";
  /** Only drift on screens at least this wide (px). On phones, content inside a swipe row must not move vertically. */
  minWidth?: number;
};

/** translateY by a scroll factor, written with rAF straight to the DOM. Owns `transform`, so nest other transforms inside. */
export function Parallax({ children, as, className, style, speed = 0.08, origin = "center", minWidth }: ParallaxProps) {
  const ref = useRef<HTMLElement>(null);
  const Tag = (as ?? "div") as ElementType;
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || (minWidth && window.innerWidth < minWidth)) return;
    let y = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "200px 0px" });
    io.observe(el);
    const update = () => {
      if (!visible && origin === "center") return;
      let next: number;
      if (origin === "top") next = window.scrollY * speed;
      else {
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2 - y; // rest position, ignoring our own offset
        next = (window.innerHeight / 2 - center) * speed;
      }
      next = Math.round(next * 10) / 10;
      if (next === y) return;
      y = next;
      el.style.transform = `translate3d(0, ${y}px, 0)`;
    };
    const off = subscribeScroll(update);
    return () => {
      off();
      io.disconnect();
      el.style.transform = "";
    };
  }, [speed, origin, minWidth]);
  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}
