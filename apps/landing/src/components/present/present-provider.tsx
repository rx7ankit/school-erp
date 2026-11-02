"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type Origin = { x: number; y: number };
type Ctx = { active: boolean; start: (from?: Element | Origin | null) => void; stop: () => void };

const PresentContext = createContext<Ctx>({ active: false, start: () => {}, stop: () => {} });
export const usePresent = () => useContext(PresentContext);

const loadDeck = () => import("./deck");
const Deck = dynamic(loadDeck, { ssr: false });

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Owns presentation state, the P key, and the page-to-deck morph. The site lives in #site-root so it can scale
 * and blur away while the deck's circular reveal expands from the Present button.
 */
export function PresentProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false); // deck mounted
  const [shown, setShown] = useState(false); // reveal wanted
  const [origin, setOrigin] = useState<Origin>({ x: 0, y: 0 });
  const root = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const saved = useRef<{ y: number; focus: HTMLElement | null }>({ y: 0, focus: null });

  const start = useCallback((from?: Element | Origin | null) => {
    if (busy.current) return;
    busy.current = true;
    let o: Origin = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    if (from && "getBoundingClientRect" in from) {
      const r = from.getBoundingClientRect();
      if (r.width > 0) o = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    } else if (from) o = from;
    loadDeck().then(() => {
      saved.current = { y: window.scrollY, focus: document.activeElement as HTMLElement | null };
      const el = document.documentElement;
      const gap = window.innerWidth - el.clientWidth;
      if (gap > 0) document.body.style.paddingRight = `${gap}px`;
      el.style.overflow = "hidden";
      root.current?.style.setProperty("--ty", `${window.scrollY + window.innerHeight / 2}px`);
      setOrigin(o);
      setOpen(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    });
  }, []);

  const stop = useCallback(() => setShown(false), []);

  const closed = useCallback(() => {
    setOpen(false);
    busy.current = false;
    document.documentElement.style.overflow = "";
    document.body.style.paddingRight = "";
    window.scrollTo({ top: saved.current.y, behavior: "instant" as ScrollBehavior });
    saved.current.focus?.focus?.({ preventScroll: true });
  }, []);

  // P starts (and, while presenting, ends) the deck. Never while typing or with a shortcut modifier.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "p" || e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTyping(e.target)) return;
      e.preventDefault();
      if (open) stop();
      else start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, start, stop]);

  // Warm the deck chunk once the page is idle, so the first press is instant.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const idle = w.requestIdleCallback as ((cb: () => void) => number) | undefined;
    const id = idle ? idle.call(window, () => void loadDeck()) : window.setTimeout(() => void loadDeck(), 3000);
    return () => (idle ? undefined : window.clearTimeout(id));
  }, []);

  const value = useMemo(() => ({ active: open, start, stop }), [open, start, stop]);

  return (
    <PresentContext.Provider value={value}>
      <div id="site-root" ref={root} data-present={shown ? "on" : undefined} data-deck={open ? "1" : undefined} inert={open}>
        {children}
      </div>
      {open ? <Deck shown={shown} origin={origin} onExit={stop} onClosed={closed} /> : null}
    </PresentContext.Provider>
  );
}
