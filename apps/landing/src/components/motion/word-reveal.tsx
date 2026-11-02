"use client";

import type { CSSProperties, ElementType } from "react";
import { cn } from "@/lib/cn";
import { useTrigger, type On } from "./use-trigger";

export type WordRevealProps = {
  /** Single-tone text. `\n` starts a new line. */
  text?: string;
  /** Two-tone heading: `title` in the current colour, then `dim` in grey. `\n` starts a new line in either. */
  title?: string;
  dim?: string;
  as?: ElementType;
  id?: string;
  className?: string;
  /** Class for the grey part (default: the global `.dim`). */
  dimClassName?: string;
  /** "view" (default) or "hero" (plays when the hero reveal starts, no JS needed). */
  on?: On;
  delay?: number;
  /** ms between words (default 70). */
  stagger?: number;
  /** ms per word (default 900). */
  duration?: number;
  once?: boolean;
};

type Line = { words: string[]; dim: boolean };

function lines(text: string | undefined, dim: boolean): Line[] {
  if (!text) return [];
  return text.split("\n").map((l) => ({ words: l.split(/\s+/).filter(Boolean), dim }));
}

/**
 * Splits text into words. Each word sits in an overflow-hidden mask and slides up from below (with a touch of blur)
 * on a stagger. Lines are block elements, so wrapping text still reads naturally. The text stays real text.
 */
export function WordReveal({ text, title, dim, as, id, className, dimClassName = "dim", on = "view", delay = 0, stagger = 70, duration = 900, once = true }: WordRevealProps) {
  const ref = useTrigger<HTMLElement>(on, once);
  const Tag = (as ?? "div") as ElementType;
  const all = [...lines(text ?? title, false), ...lines(dim, true)];
  let n = 0;
  return (
    <Tag ref={ref} id={id} data-on={on} className={cn("mv-words", className)} style={{ "--d": `${delay}ms`, "--stg": `${stagger}ms`, "--mv-dur": `${duration}ms` } as CSSProperties}>
      {all.map((line, li) => (
        <span key={li} className={cn("block", line.dim && dimClassName)}>
          {line.words.map((w, wi) => (
            <span key={wi}>
              <span className="mv-wm">
                <span className="mv-w" style={{ "--i": n++ } as CSSProperties}>
                  {w}
                </span>
              </span>
              {wi < line.words.length - 1 ? " " : null}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
}
