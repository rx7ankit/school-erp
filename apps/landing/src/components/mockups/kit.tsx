import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { InView, Tilt } from "@/components/in-view";

/**
 * Building blocks for the product mockups. Everything is sized in `em`, so a mockup scales
 * perfectly from a phone screen to a wide desktop. Flat grey cards, hairline borders, no shadows.
 * Every mockup root is aria-hidden.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Grey panel that hosts a composed scene. 1em = 1/56 of the panel width. */
export function Stage({ children, ratio = "56 / 50", className }: { children: ReactNode; ratio?: string; className?: string }) {
  return (
    <InView
      className={cn("relative overflow-hidden rounded-[28px] bg-card [container-type:inline-size]", className)}
      style={{ aspectRatio: ratio }}
    >
      <div aria-hidden="true" className="absolute inset-0 select-none">
        <Tilt className="absolute inset-0">
          <div className="absolute inset-0 text-text" style={{ fontSize: "calc(100cqw / 56)" }}>
            {children}
          </div>
        </Tilt>
      </div>
    </InView>
  );
}

/** App window placed in a Stage (positions in em). */
export function Win({ x, y, w, children, className, style }: { x: number; y: number; w: number; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn("absolute overflow-hidden rounded-[1.6em] border border-separator bg-bg", className)}
      style={{ left: `${x}em`, top: `${y}em`, width: `${w}em`, ...style }}
    >
      {children}
    </div>
  );
}

type ChipProps = {
  children: ReactNode;
  /** Absolute placement in em, e.g. { right: 2, top: 3 } */
  at: { left?: number; right?: number; top?: number; bottom?: number };
  delay?: number;
  /** Scroll parallax distance in px (positive moves against the scroll). */
  par?: number;
  floatSpeed?: number;
  className?: string;
};

/** Small floating card that overlaps a frame. Pops in, floats gently, drifts on scroll. */
export function Chip({ children, at, delay = 500, par = 22, floatSpeed = 7, className }: ChipProps) {
  const pos: CSSProperties = {};
  for (const [k, v] of Object.entries(at)) (pos as Record<string, string>)[k] = `${v}em`;
  return (
    <div className="par absolute z-10" style={{ ...pos, "--pa": `${par}px` } as Vars}>
      <div className="pop" style={{ "--d": `${delay}ms` } as Vars}>
        <div className="float" style={{ "--fs": `${floatSpeed}s`, "--fd": `-${delay / 300}s` } as Vars}>
          <div className={cn("w-max rounded-[1.4em] border border-separator bg-bg p-[1em]", className)}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Avatar({ name, className, tone = "grey" }: { name: string; className?: string; tone?: "grey" | "accent" | "dark" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={cn(
        "grid size-[3em] shrink-0 place-items-center rounded-full text-[1.1em] font-bold",
        tone === "grey" && "bg-fill text-text-secondary",
        tone === "accent" && "bg-accent-subtle text-accent",
        tone === "dark" && "bg-solid text-on-solid",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Pill({ children, tone = "grey", className }: { children: ReactNode; tone?: "grey" | "accent" | "success" | "dark" | "danger" | "white"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-max items-center gap-[0.5em] whitespace-nowrap rounded-full px-[0.9em] py-[0.35em] text-[1.05em] font-semibold",
        tone === "grey" && "bg-fill text-text-secondary",
        tone === "accent" && "bg-accent-subtle text-accent",
        tone === "success" && "bg-success/10 text-success",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "dark" && "bg-solid text-on-solid",
        tone === "white" && "bg-bg text-accent",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Progress ring (animated once when visible). `value` is 0-100. */
export function Ring({ value, className, stroke = 3.4, children, color = "var(--c-accent)" }: { value: number; className?: string; stroke?: number; children?: ReactNode; color?: string }) {
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--c-fill)" strokeWidth={stroke} />
        <circle
          className="ring-fg"
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{ "--off": 100 - value } as Vars}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

/** Horizontal bar that grows in. */
export function Bar({ pct, delay = 300, color = "bg-solid", className }: { pct: number; delay?: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-[0.8em] overflow-hidden rounded-full bg-fill", className)}>
      <div className={cn("barx h-full rounded-full", color)} style={{ width: `${pct}%`, "--d": `${delay}ms` } as Vars} />
    </div>
  );
}

/** Self-scaling frame: width is set by the parent, 1em = width / design. */
export function Scaled({ design, ratio, className, children, style }: { design: number; ratio: string; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={cn("[container-type:inline-size]", className)} style={{ aspectRatio: ratio, ...style }}>
      <div className="size-full select-none text-text" style={{ fontSize: `calc(100cqw / ${design})` }} aria-hidden="true">
        {children}
      </div>
    </div>
  );
}
