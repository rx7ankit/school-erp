"use client";

import { useEffect } from "react";
import { LOCKUP_VIEWBOX, MARK, MARK_T, WORDMARK, WORD_T } from "@/components/logo";

/**
 * First-visit intro. An inline script in <head> (layout.tsx) decides before first paint: `html[data-intro="play"]`
 * means "show the intro" (first visit this session, no hash, motion allowed). Otherwise nothing here shows.
 *
 * Stages (html[data-intro]): play (flat #ECECF0 + big logo) -> morph (logo flies into the real header logo, the nav
 * pill grows out of it, links stagger, CTA pops, pill rises, overlay dissolves; all CSS transitions in globals.css,
 * keyed to this attribute) -> done. `html[data-hero="go"]` starts the hero reveal (also set on every non-intro load).
 * The header's own resting styles are the end state, so skipping at any moment lands exactly on the final layout.
 */
const HOLD = 1750; // ms the splash is held: the mark spins alone, then slides left as the name comes in
const FLY = 900; // logo glide
const HERO_AT = 1350; // hero reveal starts while the pill is still rising
const DONE_AT = 2000;

export function Intro() {
  useEffect(() => {
    const root = document.documentElement;
    const timers: number[] = [];
    let cancelled = false;
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const fonts = () => Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 900))]);
    const heroGo = () => {
      root.dataset.hero = "go";
    };

    if (root.dataset.intro !== "play") {
      // No intro: let fonts settle, then play the hero reveal.
      fonts().then(() => {
        if (!cancelled) requestAnimationFrame(heroGo);
      });
      return () => {
        cancelled = true;
      };
    }

    const block = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("wheel", block, { capture: true, passive: false });
    window.addEventListener("touchmove", block, { capture: true, passive: false });

    const finish = () => {
      timers.forEach(clearTimeout);
      root.dataset.introLogo = "1";
      root.dataset.intro = "done";
      heroGo();
      window.removeEventListener("wheel", block, true);
      window.removeEventListener("touchmove", block, true);
      window.removeEventListener("keydown", finish);
      window.removeEventListener("pointerdown", finish);
    };
    window.addEventListener("keydown", finish);
    window.addEventListener("pointerdown", finish);

    fonts().then(() => {
      if (cancelled) return;
      later(() => {
        const splash = document.getElementById("intro-logo");
        const target = document.querySelector("[data-site-logo] svg");
        if (!splash || !target) return finish();
        const from = splash.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        splash.style.transform = `translate3d(${to.left - from.left}px, ${to.top - from.top}px, 0) scale(${to.width / from.width})`;
        root.dataset.intro = "morph";
        later(() => (root.dataset.introLogo = "1"), FLY); // hand over to the real header logo, pixel for pixel
        later(heroGo, HERO_AT);
        later(finish, DONE_AT);
      }, Math.max(0, HOLD - performance.now()));
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("wheel", block, true);
      window.removeEventListener("touchmove", block, true);
      window.removeEventListener("keydown", finish);
      window.removeEventListener("pointerdown", finish);
    };
  }, []);

  return (
    <div id="intro-root" aria-hidden="true">
      <div id="intro" />
      <div id="intro-stage">
        <div id="intro-logo" className="text-text">
          {/* Same artwork as <Logo>, split so the S mark can spin in on its own and settle at rest for the hand-over. */}
          <svg viewBox={LOCKUP_VIEWBOX} fill="currentColor" role="img" aria-label="Krevo" className="h-auto w-full">
            <g transform={WORD_T}>
              <path className="intro-word" d={WORDMARK} />
            </g>
            <g className="intro-slide">
              <g transform={MARK_T}>
                <g className="intro-mark">{MARK}</g>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
