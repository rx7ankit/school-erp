"use client";

import { cn } from "@/lib/cn";
import { usePresent } from "./present-provider";

/** Full-width row with a tiny P key chip, used in the mobile menu (desktop uses the P shortcut). */
export function PresentButton({ className, onBefore }: { className?: string; onBefore?: () => void }) {
  const { start } = usePresent();
  return (
    <button
      type="button"
      aria-label="Present: turn this site into a slide deck (P)"
      onClick={(e) => {
        onBefore?.();
        start(e.currentTarget);
      }}
      className={cn("flex w-full items-center justify-between py-4 text-left text-[32px] font-bold leading-none tracking-[-0.035em] text-text focus-visible:outline-2", className)}
    >
      Present
      <kbd className="grid size-8 place-items-center rounded-lg bg-fill font-sans text-[14px] font-semibold leading-none text-text-secondary">P</kbd>
    </button>
  );
}
