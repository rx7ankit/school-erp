"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useTrigger, type On } from "./use-trigger";

export type DrawLineProps = {
  /** One path `d`, or several (they draw together, offset by `stagger`). */
  d: string | string[];
  viewBox: string;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
  /** ms before drawing (default 0). */
  delay?: number;
  /** ms per path (default 1400). */
  duration?: number;
  /** ms between paths (default 150). */
  stagger?: number;
  on?: On;
  once?: boolean;
  /** Extra static SVG content (nodes, dots) rendered above the lines. */
  children?: ReactNode;
  preserveAspectRatio?: string;
};

/** SVG path whose stroke draws itself (stroke-dashoffset, via pathLength=1). Decorative (aria-hidden). */
export function DrawLine({ d, viewBox, className, stroke = "currentColor", strokeWidth = 1.5, delay = 0, duration = 1400, stagger = 150, on = "view", once = true, children, preserveAspectRatio }: DrawLineProps) {
  const ref = useTrigger<SVGSVGElement>(on, once);
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg ref={ref} data-on={on} viewBox={viewBox} fill="none" aria-hidden="true" preserveAspectRatio={preserveAspectRatio} className={cn("mv-draw", className)}>
      {paths.map((p, i) => (
        <path key={i} d={p} pathLength={1} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ "--d": `${delay + i * stagger}ms`, "--mv-dur": `${duration}ms` } as CSSProperties} />
      ))}
      {children}
    </svg>
  );
}
