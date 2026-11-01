"use client";
import * as React from "react";
import type { Decision } from "@/lib/rollover";
import { cn } from "@/lib/utils";

const TONE: Record<Decision, string> = {
  promote: "bg-success/15 text-success",
  stay: "bg-warning/15 text-warning",
  leave: "bg-danger/15 text-danger",
};

/** Promote / Stay in this class / Leaving school. A radio group, so arrow keys move between the three. */
export function DecisionToggle({ name, value, onChange, promoteLabel = "Promote" }: {
  name: string; value: Decision; onChange: (d: Decision) => void; promoteLabel?: string;
}) {
  const options: { value: Decision; label: string }[] = [{ value: "promote", label: promoteLabel }, { value: "stay", label: "Stay" }, { value: "leave", label: "Leaving" }];
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: React.KeyboardEvent, i: number) {
    const move = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!move) return;
    e.preventDefault();
    const n = (i + move + options.length) % options.length;
    onChange(options[n].value); refs.current[n]?.focus();
  }
  return (
    <div role="radiogroup" aria-label={`Decision for ${name}`} className="inline-flex shrink-0 rounded-full bg-separator/50 p-0.5">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            title={o.value === "stay" ? "Stay in this class" : o.value === "leave" ? "Leaving school" : undefined}
            onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)}
            className={cn("h-8 min-w-[4.25rem] cursor-pointer rounded-full px-3 text-[13px] font-medium transition-colors", on ? TONE[o.value] : "text-muted-foreground hover:text-foreground")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
