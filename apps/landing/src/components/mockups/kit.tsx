import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { InView, Tilt } from "@/components/in-view";

/**
 * Building blocks for the product mockups. Everything is sized in `em`, so a mockup scales
 * perfectly from a phone screen to a wide desktop. Surfaces are told apart by fill, radius and spacing, never by outlines.
 * Every mockup root is aria-hidden.
 */

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Grey panel that hosts a composed scene. 1em = 1/56 of the panel width. */
export function Stage({ children, ratio = "56 / 50", className }: { children: ReactNode; ratio?: string; className?: string }) {
  return (
    <InView
      className={cn("relative overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#F7F7F9,#EEEEF1)] [container-type:inline-size]", className)}
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
      className={cn("absolute overflow-hidden rounded-[2.2em] bg-bg", className)}
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
  /** "dark" is a glassy ink notification, for use over pale or white areas. */
  surface?: "light" | "dark";
  floatSpeed?: number;
  className?: string;
};

/** Small floating card that overlaps a frame. Pops in, floats gently, drifts on scroll. */
export function Chip({ children, at, delay = 500, par = 22, floatSpeed = 7, surface = "light", className }: ChipProps) {
  const pos: CSSProperties = {};
  for (const [k, v] of Object.entries(at)) (pos as Record<string, string>)[k] = `${v}em`;
  return (
    <div className="par absolute z-10" style={{ ...pos, "--pa": `${par}px` } as Vars}>
      <div className="pop" style={{ "--d": `${delay}ms` } as Vars}>
        <div className="float" style={{ "--fs": `${floatSpeed}s`, "--fd": `-${delay / 300}s` } as Vars}>
          <div className={cn("w-max rounded-[1.9em] p-[1.1em] backdrop-blur-xl backdrop-saturate-150", surface === "dark" ? "bg-solid/85 text-on-solid [&_.sub]:text-on-solid/60" : "bg-bg/90", className)}>{children}</div>
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
        "grid size-[3em] shrink-0 place-items-center rounded-full text-[1.05em] font-semibold tracking-[0.01em]",
        tone === "grey" && "bg-[linear-gradient(150deg,#F0F0F3,#D9D9DE)] text-text-secondary",
        tone === "accent" && "bg-[linear-gradient(150deg,#F0F0F3,#D9D9DE)] text-text",
        tone === "dark" && "bg-[linear-gradient(150deg,#3A3A3D,#0B0B0C)] text-on-solid",
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
        "inline-flex w-max items-center gap-[0.5em] whitespace-nowrap rounded-full px-[1em] py-[0.4em] text-[1.05em] font-semibold",
        tone === "grey" && "bg-fill text-text-secondary",
        tone === "accent" && "bg-fill text-text",
        tone === "success" && "bg-success/[0.09] text-success",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "dark" && "bg-solid text-on-solid",
        tone === "white" && "bg-bg text-text",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Progress ring (animated once when visible). `value` is 0-100. */
export function Ring({ value, className, stroke = 3.4, children, color = "var(--c-solid)" }: { value: number; className?: string; stroke?: number; children?: ReactNode; color?: string }) {
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--c-fill)" strokeOpacity="0.8" strokeWidth={stroke} />
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
    <div className={cn("h-[0.7em] overflow-hidden rounded-full bg-fill/70", className)}>
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

/** Rounded vertical bars that grow in. `hi` is the one highlighted bar (ink or accent). */
export function Bars({ values, hi, className, accent = true, delay = 500 }: { values: number[]; hi: number; className?: string; accent?: boolean; delay?: number }) {
  return (
    <div className={cn("flex items-end gap-[0.5em]", className)}>
      {values.map((h, i) => (
        <span
          key={i}
          className={cn("bary flex-1 rounded-full", i === hi ? (accent ? "bg-accent" : "bg-solid") : "bg-[linear-gradient(to_top,#DEDEE3,#EAEAEE)]")}
          style={{ height: `${h}%`, "--d": `${delay + i * 70}ms` } as Vars}
        />
      ))}
    </div>
  );
}

/** Smooth area chart: grey gradient fade, ink line, one highlighted point. */
export function Area({ points, hi, className }: { points: number[]; hi: number; className?: string }) {
  const W = 100;
  const H = 40;
  const step = W / (points.length - 1);
  const xy = points.map((v, i) => [i * step, H - 4 - (v / 100) * (H - 10)] as const);
  let d = `M${xy[0][0]} ${xy[0][1]}`;
  for (let i = 1; i < xy.length; i++) {
    const [x0, y0] = xy[i - 1];
    const [x1, y1] = xy[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  const id = `area-${points.join("")}`;
  const [hx, hy] = xy[hi];
  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1D1D1F" stopOpacity="0.14" />
            <stop offset="1" stopColor="#1D1D1F" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${W} ${H} L0 ${H}Z`} fill={`url(#${id})`} />
        <path d={d} fill="none" stroke="#1D1D1F" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <i className="absolute size-[1.1em] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ left: `${(hx / W) * 100}%`, top: `${(hy / H) * 100}%` }} />
    </div>
  );
}

/** Round icon tile used inside chips and rows. */
export function Tile({ children, tone = "grey", className }: { children: ReactNode; tone?: "grey" | "dark" | "success" | "white" | "glass"; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        tone === "grey" && "bg-fill/70 text-text",
        tone === "dark" && "bg-solid text-on-solid",
        tone === "success" && "bg-success/[0.1] text-success",
        tone === "white" && "bg-bg text-text",
        tone === "glass" && "bg-on-solid/15 text-on-solid",
        className,
      )}
    >
      {children}
    </span>
  );
}
