import * as React from "react";
import { Card } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders. They copy the real layout (same cards, same grid, same paddings), so when the data arrives
 * only the text changes: the real content fades and slides up (`Appear`) into the space the blocks held.
 * Flat fills with a slow shimmer; no shadows. Still when the user prefers reduced motion.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={cn("sk rounded-lg", className)} style={style} />;
}

/** `lines` text lines; the last one is shorter. */
export function SkeletonText({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />)}
    </div>
  );
}

/** Wraps a loading screen so assistive tech hears one "Loading" instead of a row of empty boxes. */
export function SkPage({ children, className, label = "Loading" }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn("flex flex-col gap-6", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** The page title row. */
export function SkHeader({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <Skeleton className="h-9 w-48 rounded-xl sm:h-10 sm:w-60" />
      {actions > 0 && <div className="flex gap-2.5">{Array.from({ length: actions }, (_, i) => <Skeleton key={i} className="h-10 w-28 rounded-full" />)}</div>}
    </div>
  );
}

/** One headline-number card: matches StatCard. */
export function SkStat() {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3"><Skeleton className="h-3.5 w-24" /><Skeleton className="size-9 rounded-full" /></div>
      <div><Skeleton className="h-8 w-28 rounded-xl" /><Skeleton className="mt-3 h-3 w-36" /></div>
    </Card>
  );
}

export function SkStatGrid({ count = 4 }: { count?: number }) {
  return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: count }, (_, i) => <SkStat key={i} />)}</div>;
}

/** A card with a title and description line, then whatever you pass (default: a block of `height`px). */
export function SkCard({ children, height = 200, title = true, className }: { children?: React.ReactNode; height?: number; title?: boolean; className?: string }) {
  return (
    <Card className={className}>
      {title && <div className="mb-6"><Skeleton className="h-5 w-40" /><Skeleton className="mt-2 h-3 w-56" /></div>}
      {children ?? <Skeleton className="w-full rounded-2xl" style={{ height }} />}
    </Card>
  );
}

/** A line chart or bar chart: faint bars of different heights. */
export function SkChart({ height = 200 }: { height?: number }) {
  const bars = [40, 62, 48, 74, 56, 84, 60, 70, 52, 78, 64, 88];
  return (
    <div className="flex items-end gap-2" style={{ height }} aria-hidden="true">
      {bars.map((h, i) => <Skeleton key={i} className="flex-1 rounded-t-lg rounded-b-sm" style={{ height: `${h}%` }} />)}
    </div>
  );
}

/** Horizontal bar rows: label, bar, value. */
export function SkBars({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-3.5" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="grid grid-cols-[96px_1fr_48px] items-center gap-3 sm:grid-cols-[140px_1fr_56px]">
          <Skeleton className="h-3.5 w-20" /><Skeleton className="h-3 rounded-full" style={{ width: `${88 - i * 9}%` }} /><Skeleton className="h-3.5 w-10 justify-self-end" />
        </li>
      ))}
    </ul>
  );
}

/** List rows with an optional round avatar, a title line, a smaller line and a trailing pill. */
export function SkList({ rows = 5, avatar = true, trailing = true, className }: { rows?: number; avatar?: boolean; trailing?: boolean; className?: string }) {
  return (
    <ul className={cn("flex flex-col", className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 border-t border-border py-3.5 first:border-t-0 first:pt-0 last:pb-0">
          {avatar && <Skeleton className="size-10 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1"><Skeleton className="h-4 w-2/5" /><Skeleton className="mt-2 h-3 w-1/4" /></div>
          {trailing && <Skeleton className="h-7 w-16 shrink-0 rounded-full" />}
        </li>
      ))}
    </ul>
  );
}

/** Table body rows. Use inside <TableBody>: `{q.isPending && <SkTableRows cols={5} />}`. */
export function SkTableRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {Array.from({ length: cols }, (_, c) => (
            <TableCell key={c}><Skeleton className="h-4" style={{ width: c === 0 ? "70%" : `${45 + ((r + c * 2) % 4) * 12}%` }} /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Real content arriving: fades in and slides up. `i` staggers siblings (0, 1, 2 ...). */
export function Appear({ children, className, i = 0, as: Tag = "div" }: { children: React.ReactNode; className?: string; i?: number; as?: "div" | "section" | "ul" | "li" | "span" }) {
  return <Tag className={cn("appear", className)} style={{ "--i": i } as React.CSSProperties}>{children}</Tag>;
}
