"use client";

import { useEffect, useRef, type ElementType } from "react";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "./use-trigger";
import { subscribeScroll } from "./scroll-bus";

export type ScrollWordsProps = {
  text: string;
  as?: ElementType;
  className?: string;
  /** Opacity of a word that has not been reached yet (default 0.3). */
  from?: number;
};

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Words brighten from `from` to 1 as the block scrolls up the viewport, one after another (scroll linked, no timers).
 * Starts when the block's top is at 90% of the viewport height and finishes when its bottom reaches 55%.
 * The server and reduced motion render every word at full opacity.
 */
export function ScrollWords({ text, as, className, from = 0.3 }: ScrollWordsProps) {
  const ref = useRef<HTMLElement>(null);
  const Tag = (as ?? "p") as ElementType;
  const words = text.split(/\s+/).filter(Boolean);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>("[data-w]"));
    const n = spans.length;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((vh * 0.9 - r.top) / (vh * 0.35 + r.height));
      for (let i = 0; i < n; i++) {
        const o = from + (1 - from) * clamp((p - (i / n) * 0.82) / 0.18);
        spans[i].style.opacity = o.toFixed(3);
      }
    };
    const off = subscribeScroll(update);
    return () => {
      off();
      spans.forEach((s) => (s.style.opacity = ""));
    };
  }, [from, text]);
  return (
    <Tag ref={ref} className={cn(className)}>
      {words.map((w, i) => (
        <span key={i}>
          <span data-w="">{w}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}
