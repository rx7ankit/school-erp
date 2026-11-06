"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Fade and slide up when scrolled into view. */
  reveal?: boolean;
  /** Stagger, in ms. */
  delay?: number;
  as?: "div" | "li" | "section" | "p";
  /** Share of the element that must be visible first (default 0.2). */
  threshold?: number;
};

/**
 * Marks itself `data-in="true"` once visible. CSS then animates `.rv`, `.pop`, `.grow` and `.ring-fg`
 * inside it (transform and opacity only), so no animation package is needed.
 */
export function InView({ children, className, style, reveal = false, delay = 0, as = "div", threshold }: Props) {
  const [ref, seen] = useInView<HTMLElement>(threshold);
  const Tag = as as "div";
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      data-in={seen}
      className={cn(reveal && "rv", className)}
      style={{ ...style, ...(delay ? ({ "--d": `${delay}ms` } as CSSProperties) : null) }}
    >
      {children}
    </Tag>
  );
}

/** Counts up to a number once visible. Shows the final value straight away for reduced motion. */
export function CountUp({ to, prefix = "", suffix = "", duration = 1300 }: { to: number; prefix?: string; suffix?: string; duration?: number }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.3);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

/** Slight 3D tilt that follows the pointer (mouse only). Content must be inside. */
export function Tilt({ children, className, max = 3 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.setProperty("--ry", `${(px * max * 2).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-py * max * 2).toFixed(2)}deg`);
    });
  }
  function leave() {
    cancelAnimationFrame(raf.current);
    ref.current?.style.setProperty("--ry", "0deg");
    ref.current?.style.setProperty("--rx", "0deg");
  }
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={cn("tilt", className)}>
      {children}
    </div>
  );
}
