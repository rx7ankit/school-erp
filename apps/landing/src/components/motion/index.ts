/**
 * Motion kit. Tiny, client-side, no animation library (only `lenis` for smooth scrolling). Everything animates
 * transform / opacity / filter, plays from IntersectionObserver or the hero start, is visible without JS (the
 * hidden start states only apply under `html.js`) and shows the final state for prefers-reduced-motion.
 * The CSS lives in globals.css under "Motion". Every primitive takes `on="view"` (default, scroll into view) or
 * `on="hero"` (plays when the intro/hero reveal starts: `html[data-hero="go"]`, no JS needed).
 *
 *   <SmoothScroll>               layout.tsx wraps the app once. `useLenis()` gives the Lenis instance (or null).
 *                                Anchor links (#software ...) glide with a nav offset. Locks (html overflow:hidden,
 *                                e.g. mobile menu or deck) pause it automatically; add data-lenis-prevent to any
 *                                inner scroller.
 *   <Reveal delay y blur duration once i stagger as>      fade up + blur-to-sharp. Stagger children with i={0,1,2}.
 *   <WordReveal title dim | text as delay stagger>        words slide up inside overflow-hidden masks. Two-tone via
 *                                title + dim, "\n" for line breaks, e.g. <WordReveal as="h2" title="One app." dim="Every role." />
 *   <CountUp to from prefix suffix decimals duration delay>   tabular number roll (final value in SSR, width reserved).
 *   <DrawLine d viewBox stroke strokeWidth delay duration stagger>  SVG stroke draw (pathLength=1). d can be an array.
 *   <Pop delay i stagger>        scale .6 to 1 with overshoot. Owns transform, so put floats/parallax on other elements.
 *   <ScrollWords text from>      words brighten from 30% to 100% opacity with scroll progress (quotes).
 *   <Parallax speed origin>      translateY by scroll factor (rAF, one shared listener). Positive speed lags the page.
 *   <Ambient/>                   the fixed page background (already mounted in app/page.tsx).
 *
 * Rules: one transform owner per element (nest wrappers); never put backdrop-filter inside an element that animates
 * `filter` (Reveal with blur>0) until it has finished, or pass blur={0}; box-shadow is banned by the tokens, use
 * filter: drop-shadow() or fills.
 */
export { Ambient } from "./ambient";
export { CountUp } from "./count-up";
export { DrawLine } from "./draw-line";
export { Parallax } from "./parallax";
export { Pop } from "./pop";
export { Reveal } from "./reveal";
export { ScrollWords } from "./scroll-words";
export { NAV_OFFSET, SmoothScroll, useLenis } from "./smooth-scroll";
export { WordReveal } from "./word-reveal";
