"use client";

import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useTrigger, type On } from "./use-trigger";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

export type RevealProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Delay in ms. */
  delay?: number;
  /** Start offset in px (default 24). */
  y?: number;
  /** Start blur in px (default 8). 0 skips the filter entirely (use it for big surfaces). */
  blur?: number;
  /** Duration in ms (default 900). */
  duration?: number;
  /** "view" (default) plays on scroll into view; "hero" plays when the hero reveal starts. */
  on?: On;
  /** Play once (default) or re-hide when it leaves the viewport. */
  once?: boolean;
  /** Index for staggered children: delay becomes delay + i * stagger. */
  i?: number;
  stagger?: number;
};

/** Fade up + blur-to-sharp. Transform, opacity and filter only. Visible without JS and for reduced motion. */
export function Reveal({ children, as, className, style, delay = 0, y = 24, blur = 8, duration = 900, on = "view", once = true, i = 0, stagger = 90 }: RevealProps) {
  const ref = useTrigger<HTMLElement>(on, once);
  const Tag = (as ?? "div") as ElementType;
  const vars: Vars = { "--d": `${delay + i * stagger}ms`, "--mv-y": `${y}px`, "--mv-blur": `${blur}px`, "--mv-dur": `${duration}ms`, ...style };
  return (
    <Tag ref={ref} data-on={on} data-blur={blur === 0 ? "0" : undefined} className={cn("mv-rise", className)} style={vars}>
      {children}
    </Tag>
  );
}
