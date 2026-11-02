"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { observeView, prefersReducedMotion, whenHeroGo, type On } from "./use-trigger";

export type CountUpProps = {
  to: number;
  from?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** ms (default 1400). */
  duration?: number;
  /** ms after the trigger. */
  delay?: number;
  on?: On;
  className?: string;
  locale?: string;
};

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const ease = (t: number) => 1 - Math.pow(1 - t, 4); // easeOutQuart: fast start, long soft landing

/**
 * Number roll with easing. Server and no-JS render the final value; the animated text is written straight to the DOM
 * (no re-renders). A hidden copy of the final number reserves the width, so nothing shifts while counting.
 */
export function CountUp({ to, from = 0, prefix = "", suffix = "", decimals = 0, duration = 1400, delay = 0, on = "view", className, locale = "en-IN" }: CountUpProps) {
  const live = useRef<HTMLSpanElement>(null);
  const fmt = (v: number) => `${prefix}${v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  const final = fmt(to);

  useIsoLayoutEffect(() => {
    if (!prefersReducedMotion() && live.current) live.current.textContent = fmt(from);
  }, []);

  useEffect(() => {
    const el = live.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    let timer = 0;
    const run = () => {
      timer = window.setTimeout(() => {
        const t0 = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / duration);
          el.textContent = fmt(from + (to - from) * ease(t));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, delay);
    };
    const stop = on === "hero" ? whenHeroGo(run) : observeView(el, (v) => v && run(), true, "0px 0px -8% 0px");
    return () => {
      stop();
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, from, duration, delay, on]);

  return (
    <span className={cn("inline-grid justify-items-start [font-variant-numeric:tabular-nums]", className)}>
      <span className="col-start-1 row-start-1 [color:transparent]">{final}</span>
      <span ref={live} aria-hidden="true" className="col-start-1 row-start-1">
        {final}
      </span>
    </span>
  );
}
