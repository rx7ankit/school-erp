import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared building blocks for the product mockups. They copy the look of apps/web
 * (flat grey cards, pill badges, no borders, no shadows) but are plain markup:
 * nothing here is interactive, and every mockup root is aria-hidden.
 */

/** Root of any mockup: hidden from assistive tech, not selectable, container-query aware. */
export function Mockup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("@container select-none text-text", className)}>
      {children}
    </div>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

const toneClass: Record<Tone, string> = {
  neutral: "text-text-secondary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  brand: "text-accent",
};

/** Same pill as the web app's Badge: grey fill, dot in the tone colour. */
export function MBadge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-fill px-2.5 text-[11px] font-medium before:size-1.5 before:rounded-full before:bg-current",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function MAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-fill text-[11px] font-bold text-text-secondary", className)}>
      {initials}
    </span>
  );
}

export function MSwitch({ on }: { on: boolean }) {
  return (
    <span className={cn("relative inline-block h-[22px] w-[38px] shrink-0 rounded-full", on ? "bg-accent" : "bg-separator")}>
      <span className={cn("absolute top-0.5 size-[18px] rounded-full bg-bg", on ? "left-[18px]" : "left-0.5")} />
    </span>
  );
}

/** Grey panel with a small title row, used inside the app window. */
export function MPanel({ title, aside, children, className }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-[16px] bg-card p-4", className)}>
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold tracking-[-0.01em]">{title}</p>
          {aside}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** App window: page-coloured surface the mockup content sits on. */
export function MWindow({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[20px] bg-bg", className)}>
      <div className="flex h-9 items-center gap-1.5 px-4">
        <span className="size-2.5 rounded-full bg-separator" />
        <span className="size-2.5 rounded-full bg-separator" />
        <span className="size-2.5 rounded-full bg-separator" />
        <span className="ml-3 truncate text-[11px] font-medium text-text-tertiary">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function MStat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: Tone }) {
  return (
    <div className="min-w-0 rounded-[16px] bg-card p-3.5">
      <p className="truncate text-[11px] font-medium text-text-secondary">{label}</p>
      <p className={cn("mt-1 text-[22px] font-bold leading-none tracking-[-0.03em]", tone && toneClass[tone])}>{value}</p>
      {note ? <p className="mt-1.5 truncate text-[11px] text-text-tertiary">{note}</p> : null}
    </div>
  );
}
