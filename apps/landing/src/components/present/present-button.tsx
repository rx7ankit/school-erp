"use client";

import { cn } from "@/lib/cn";
import { usePresent } from "./present-provider";

const KEY = "grid size-5 place-items-center rounded-md bg-fill text-[11px] font-semibold leading-none text-text-secondary";

/** Ghost pill with a tiny P key chip. `menu` is the full-width row used in the mobile menu. */
export function PresentButton({ variant = "nav", className, onBefore }: { variant?: "nav" | "menu"; className?: string; onBefore?: () => void }) {
  const { start } = usePresent();
  return (
    <button
      type="button"
      aria-label="Present: turn this site into a slide deck (P)"
      onClick={(e) => {
        onBefore?.();
        start(e.currentTarget);
      }}
      className={cn(
        variant === "nav"
          ? "inline-flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium text-text-secondary hover:bg-card hover:text-text focus-visible:outline-2"
          : "flex min-h-12 w-full items-center justify-between rounded-[14px] px-4 text-[17px] font-semibold text-text hover:bg-card-hover focus-visible:outline-2",
        className,
      )}
    >
      Present
      <kbd className={cn(KEY, "font-sans")}>P</kbd>
    </button>
  );
}
