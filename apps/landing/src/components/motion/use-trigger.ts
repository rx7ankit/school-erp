"use client";

import { useEffect, useRef } from "react";

/** When a motion primitive plays: when scrolled into view, or when the hero reveal starts (`html[data-hero="go"]`). */
export type On = "view" | "hero";

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Runs `cb` once the hero reveal has started (immediately if it already has). Returns a cleanup. */
export function whenHeroGo(cb: () => void): () => void {
  const root = document.documentElement;
  if (root.dataset.hero === "go") {
    cb();
    return () => {};
  }
  const mo = new MutationObserver(() => {
    if (root.dataset.hero === "go") {
      mo.disconnect();
      cb();
    }
  });
  mo.observe(root, { attributes: true, attributeFilter: ["data-hero"] });
  return () => mo.disconnect();
}

/** Calls `cb(true)` when the element enters the viewport and, unless `once`, `cb(false)` when it leaves. */
export function observeView(el: Element, cb: (visible: boolean) => void, once: boolean, margin = "0px 0px -10% 0px"): () => void {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        cb(true);
        if (once) io.disconnect();
      } else if (!once) cb(false);
    },
    { threshold: 0.01, rootMargin: margin },
  );
  io.observe(el);
  return () => io.disconnect();
}

/**
 * Drives the CSS reveal states. The element gets `data-in="true"` when it should play. CSS (globals.css, "Motion")
 * does the rest, so there is no React state and no re-render. Hero-mode elements need no JS at all: CSS keys
 * them off `html[data-hero="go"]`. Without JS (no `html.js`) everything is simply visible.
 */
export function useTrigger<T extends HTMLElement | SVGElement>(on: On, once = true, margin?: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || on !== "view") return;
    if (prefersReducedMotion()) {
      el.dataset.in = "true";
      return;
    }
    return observeView(el, (v) => (el.dataset.in = v ? "true" : "false"), once, margin);
  }, [on, once, margin]);
  return ref;
}
