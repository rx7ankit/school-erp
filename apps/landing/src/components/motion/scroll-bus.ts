"use client";

/** One passive scroll + resize listener for every scroll-linked primitive, flushed once per frame. */
type Sub = () => void;
const subs = new Set<Sub>();
let raf = 0;
let bound = false;

function flush() {
  raf = 0;
  subs.forEach((s) => s());
}
function schedule() {
  if (!raf) raf = requestAnimationFrame(flush);
}

export function subscribeScroll(fn: Sub): () => void {
  subs.add(fn);
  if (!bound) {
    bound = true;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
  }
  schedule();
  return () => {
    subs.delete(fn);
    if (!subs.size && bound) {
      bound = false;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    }
  };
}
