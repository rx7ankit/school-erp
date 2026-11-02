"use client";

import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useTrigger, type On } from "./use-trigger";

export type PopProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Delay in ms. */
  delay?: number;
  /** Index in a group; delay becomes delay + i * stagger. */
  i?: number;
  stagger?: number;
  on?: On;
  once?: boolean;
};

/** Scale .6 to 1 with an overshoot (cubic-bezier .34,1.56,.64,1). Give it its own element: it owns `transform`. */
export function Pop({ children, as, className, style, delay = 0, i = 0, stagger = 80, on = "view", once = true }: PopProps) {
  const ref = useTrigger<HTMLElement>(on, once);
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag ref={ref} data-on={on} className={cn("mv-pop", className)} style={{ "--d": `${delay + i * stagger}ms`, ...style } as CSSProperties}>
      {children}
    </Tag>
  );
}
