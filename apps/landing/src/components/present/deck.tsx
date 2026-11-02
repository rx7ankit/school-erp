"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/cn";
import type { Origin } from "./present-provider";
import { SLIDES } from "./slides";

const W = 1920;
const H = 1080;
const N = SLIDES.length;
const LOGO_W = 660; // logo width on the title slide, in stage px
const LOGO_BIG = `translate3d(${(W - LOGO_W) / 2}px, 236px, 0) scale(1)`;
const LOGO_SMALL = `translate3d(120px, 62px, 0) scale(${150 / LOGO_W})`;
const MOVE_MS = 700;

type Box = { left: number; top: number; width: number };
type Fly = { from: Box; to: Box };

const box = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width });
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Logo that flies between the site header and the title slide. It sits above the clipped reveal. */
function FlyLogo({ from, to }: Fly) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        el.style.transform = `translate3d(${to.left - from.left}px, ${to.top - from.top}px, 0) scale(${to.width / from.width})`;
      }),
    );
    return () => cancelAnimationFrame(id);
  }, [from, to]);
  return (
    <div ref={ref} aria-hidden="true" className="dk-fly text-text [&>svg]:h-auto [&>svg]:w-full" style={{ left: from.left, top: from.top, width: from.width }}>
      <Logo />
    </div>
  );
}

export default function Deck({ shown, origin, onExit, onClosed }: { shown: boolean; origin: Origin; onExit: () => void; onClosed: () => void }) {
  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  const [scale, setScale] = useState(1);
  const [started, setStarted] = useState(false);
  const [awake, setAwake] = useState(true);
  const [hint, setHint] = useState<string | null>(() =>
    typeof window !== "undefined" && window.innerWidth < 700 && window.innerHeight > window.innerWidth ? "Rotate your phone for a bigger view" : "keys",
  );
  const [fly, setFly] = useState<Fly | null>(null);
  const [logoHidden, setLogoHidden] = useState(false);

  if (shown && !started) setStarted(true);

  const dialog = useRef<HTMLDivElement>(null);
  const logo = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);
  const homeRect = useRef<Box | null>(null);
  const prevTimer = useRef<number | undefined>(undefined);
  const idleTimer = useRef<number | undefined>(undefined);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const wasShown = useRef(false);

  /* ---------- fit the 1920x1080 stage to the viewport ---------- */
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / W, el.clientHeight / H));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const head = document.querySelector("[data-site-logo] svg");
    if (head) homeRect.current = box(head.getBoundingClientRect());
    return () => ro.disconnect();
  }, []);

  /* ---------- navigation ---------- */
  const go = useCallback((to: number) => {
    const next = Math.max(0, Math.min(N - 1, to));
    const cur = idxRef.current;
    if (next === cur) return;
    window.clearTimeout(prevTimer.current);
    setPrev(cur);
    setDir(next > cur ? 1 : -1);
    setIdx(next);
    idxRef.current = next;
    prevTimer.current = window.setTimeout(() => setPrev(null), 700);
  }, []);

  /* ---------- reveal in / out ---------- */
  useEffect(() => {
    const reduce = reducedMotion();
    if (shown) {
      wasShown.current = true;
      dialog.current?.focus({ preventScroll: true });
      const to = logo.current?.getBoundingClientRect();
      if (!reduce && homeRect.current && to) {
        setLogoHidden(true);
        setFly({ from: homeRect.current, to: box(to) });
        const t = window.setTimeout(() => {
          setFly(null);
          setLogoHidden(false);
        }, MOVE_MS + 40);
        return () => window.clearTimeout(t);
      }
    } else if (wasShown.current) {
      const from = logo.current?.getBoundingClientRect();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      if (!reduce && idxRef.current === 0 && homeRect.current && from) {
        setLogoHidden(true);
        setFly({ from: box(from), to: homeRect.current });
      }
      const t = window.setTimeout(onClosed, reduce ? 260 : MOVE_MS + 60);
      return () => window.clearTimeout(t);
    }
  }, [shown, onClosed]);

  /* ---------- full screen: starts with the deck, and leaving it closes the deck ---------- */
  const enteredFs = useRef(false);
  useEffect(() => {
    if (!shown) return;
    const el = dialog.current;
    void el?.requestFullscreen?.().then(() => { enteredFs.current = true; }).catch(() => {});
    const onFs = () => {
      if (!document.fullscreenElement && enteredFs.current) {
        enteredFs.current = false;
        onExit();
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [shown, onExit]);

  /* ---------- hint, idle cursor ---------- */
  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setHint(null), 3200);
    return () => window.clearTimeout(t);
  }, [shown]);

  const wake = useCallback(() => {
    setAwake(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setAwake(false), 3000);
  }, []);
  useEffect(() => {
    idleTimer.current = window.setTimeout(() => setAwake(false), 3000);
    const timers = [prevTimer, idleTimer];
    return () => timers.forEach((t) => window.clearTimeout(t.current));
  }, []);

  /* ---------- keyboard: move, jump, fullscreen, exit, focus trap ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shown || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      const onButton = (document.activeElement as HTMLElement | null)?.tagName === "BUTTON";
      let handled = true;
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || (k === " " && !onButton)) go(idxRef.current + 1);
      else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") go(idxRef.current - 1);
      else if (k === "Home") go(0);
      else if (k === "End") go(N - 1);
      else if (k === "Escape") onExit();
      else if (k.toLowerCase() === "f") {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void dialog.current?.requestFullscreen?.().catch(() => {});
      } else if (k === "Tab") {
        const f = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
        if (f.length) {
          const first = f[0];
          const last = f[f.length - 1];
          const a = document.activeElement;
          if (e.shiftKey && (a === first || a === dialog.current)) last.focus();
          else if (!e.shiftKey && a === last) first.focus();
          else if (!dialog.current?.contains(a)) first.focus();
          else handled = false;
        }
      } else handled = false;
      if (handled) {
        e.preventDefault();
        wake();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, go, onExit, wake]);

  /* ---------- swipe ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    wake();
    if ((e.target as HTMLElement).closest("button")) return;
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(idxRef.current + (dx < 0 ? 1 : -1));
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && e.pointerType === "mouse" && e.button === 0) {
      // like a slide clicker: click goes forward, the far left edge goes back
      go(idxRef.current + (e.clientX < window.innerWidth * 0.2 ? -1 : 1));
    }
  };

  const visible = (prev === null ? [idx] : [prev, idx].sort((a, b) => a - b)).filter((v, i, a) => a.indexOf(v) === i);
  const cur = SLIDES[idx];
  const live = `Slide ${idx + 1} of ${N}: ${cur.name}`;
  const hiddenCursor = !awake && "cursor-none";

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Presentation"
      tabIndex={-1}
      onPointerMove={wake}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className={cn("dk-root fixed inset-0 z-[100] touch-none overflow-hidden text-text outline-none", hiddenCursor)}
      data-shown={shown}
    >
      <div
        className="dk-clip absolute inset-0 bg-bg"
        style={{ clipPath: `circle(${shown ? "135vmax" : "0px"} at ${origin.x}px ${origin.y}px)` }}
      >
        <div
          className="dk-stage absolute left-1/2 top-1/2 overflow-hidden bg-bg"
          data-started={started}
          style={{ width: W, height: H, marginLeft: -W / 2, marginTop: -H / 2, transform: `scale(${scale})`, "--dy": `${dir * 72}px` } as React.CSSProperties}
        >
          {visible.map((i) => (
            <div key={i} className={cn("dk-slide", i === idx ? "is-in" : "is-out")} aria-hidden={i !== idx}>
              {SLIDES[i].el}
            </div>
          ))}

          {/* shared element: the logo morphs between its title-slide and corner positions */}
          <div ref={logo} aria-hidden="true" className="dk-logo text-text" style={{ width: LOGO_W, transform: idx === 0 ? LOGO_BIG : LOGO_SMALL, opacity: logoHidden ? 0 : 1 }}>
            <Logo className="h-auto w-full" />
          </div>

          {cur.section ? (
            <div key={cur.section} className="absolute bottom-[44px] left-[120px] text-[26px] font-semibold text-text-tertiary" aria-hidden="true">
              {cur.section}
            </div>
          ) : null}
        </div>
      </div>

      {fly ? <FlyLogo {...fly} /> : null}

      {/* Desktop is keyboard and click only. Touch screens get a small exit button, since they have no Esc key. */}
      <button type="button" aria-label="Exit presentation" onClick={onExit} className="dk-btn absolute right-4 top-4 hidden [@media(pointer:coarse)]:grid">
        <CloseIcon className="size-5" />
      </button>

      <div aria-live="polite" className="sr-only">
        {live}
      </div>

      {hint ? (
        <div className="dk-hint pointer-events-none absolute inset-x-0 bottom-8 flex justify-center px-4" aria-hidden="true">
          <div className="flex items-center gap-2 rounded-full bg-solid px-5 py-3 text-[14px] font-medium text-on-solid">
            {hint === "keys" ? (
              <>
                <kbd className="dk-key">←</kbd>
                <kbd className="dk-key">→</kbd>
                or click to move,
                <kbd className="dk-key px-2">Esc</kbd>
                to exit
              </>
            ) : (
              hint
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
