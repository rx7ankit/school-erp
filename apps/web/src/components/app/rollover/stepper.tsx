"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = ["Check", "Students", "New year", "Teachers", "Fees", "Review"] as const;

/** Progress across the six steps. Every step can be opened at any time; nothing is a blocker. */
export function Stepper({ step, onGo }: { step: number; onGo: (n: number) => void }) {
  return (
    <nav aria-label="Year-end steps">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary sm:hidden">{step + 1}/{STEPS.length} · {STEPS[step]}</p>
      <ol className="flex gap-1.5 sm:gap-2">
        {STEPS.map((name, i) => {
          const state = i < step ? "done" : i === step ? "now" : "next";
          return (
            <li key={name} className="min-w-0 flex-1">
              <button type="button" onClick={() => onGo(i)} aria-current={state === "now" ? "step" : undefined} aria-label={`Step ${i + 1}: ${name}`}
                className="group flex w-full cursor-pointer flex-col gap-2 text-left">
                <span className={cn("h-1.5 w-full rounded-full transition-colors", state === "next" ? "bg-separator group-hover:bg-muted-foreground/40" : "bg-brand")} />
                <span className={cn("hidden items-center gap-1.5 text-[13px] sm:flex", state === "now" ? "font-bold text-foreground" : "text-muted-foreground")}>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold", state === "done" ? "bg-brand text-brand-foreground" : state === "now" ? "bg-solid text-on-solid" : "bg-fill")}>
                    {state === "done" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="truncate">{name}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
