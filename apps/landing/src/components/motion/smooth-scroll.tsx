"use client";

import Lenis from "lenis";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/** Distance kept above an anchor target so it clears the floating nav pill (px). */
export const NAV_OFFSET = 16;

const LenisContext = createContext<Lenis | null>(null);

/**
 * The Lenis instance (null on the server, before mount, and under reduced motion). Pass a callback to follow scroll:
 * `useLenis((l) => console.log(l.scroll))`.
 */
export function useLenis(onScroll?: (lenis: Lenis) => void) {
  const lenis = useContext(LenisContext);
  const cb = useRef(onScroll);
  useEffect(() => {
    cb.current = onScroll;
  });
  useEffect(() => {
    if (!lenis || !cb.current) return;
    const h = (l: Lenis) => cb.current?.(l);
    lenis.on("scroll", h);
    return () => lenis.off("scroll", h);
  }, [lenis]);
  return lenis;
}

/**
 * Inertial smooth scrolling (Lenis, expo-out, 1.15s). Off for prefers-reduced-motion (native scrolling and native
 * anchor jumps stay). Anchor clicks to this page are intercepted in the capture phase so they glide with an offset.
 * Anything that locks the page with `html { overflow: hidden }` (mobile menu, presentation deck, intro) pauses it.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const l = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      syncTouch: false,
      autoRaf: true,
    });
    const root = document.documentElement;
    document.documentElement.classList.add("lenis-on");

    const sync = () => (root.style.overflow === "hidden" ? l.stop() : l.start());
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ["style"] });
    sync();

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      const id = decodeURIComponent(url.hash.slice(1));
      const target = id === "top" ? 0 : document.getElementById(id);
      if (target === null) return;
      e.preventDefault();
      e.stopPropagation(); // keeps Next's own hash handling (an instant jump) out of the way
      history.pushState(null, "", url.hash);
      // Lets an open mobile menu close (and release its scroll lock) before we scroll; our stopPropagation skips its own onClick.
      window.dispatchEvent(new Event("krevo:anchor"));
      if (root.style.overflow !== "hidden") l.start();
      l.scrollTo(target, { offset: target === 0 ? 0 : -NAV_OFFSET, duration: 1.4 });
    };
    document.addEventListener("click", onClick, true);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLenis(l);
    return () => {
      document.removeEventListener("click", onClick, true);
      mo.disconnect();
      root.classList.remove("lenis-on");
      l.destroy();
      setLenis(null);
    };
  }, []);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
