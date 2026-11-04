"use client";
import * as React from "react";
import { Star } from "lucide-react";
import { useTr } from "@/lib/lang-context";
import type { DayMark } from "@/lib/parent-data";
import { cn } from "@/lib/utils";

/** Line chart on one scale: soft gradient area, dashed grid, a glowing last point and a hover read-out. */
export function LineChart({ data, min = 0, max = 100, format = (v) => `${v}%`, label, height = 220 }: {
  data: { label: string; value: number }[]; min?: number; max?: number; format?: (v: number) => string; label: string; height?: number;
}) {
  const id = React.useId().replace(/:/g, "");
  const [hover, setHover] = React.useState<number | null>(null);
  const W = 640, H = height, L = 44, R = 14, T = 14, B = 30;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, data.length - 1);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const ticks = [0, 2, 4].map((i) => min + ((max - min) * i) / 4);
  const every = Math.ceil(data.length / 7);
  const at = hover ?? data.length - 1;
  const cur = data[at];
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - L) / (W - L - R)) * (data.length - 1)))));
  };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y" role="img" aria-label={label} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`${id}a`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.10" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="text-foreground">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" strokeDasharray="3 5" />
              <text x={L - 10} y={y(t) + 4} textAnchor="end" className="fill-text-tertiary text-[11px]">{format(Math.round(t))}</text>
            </g>
          ))}
          <polygon points={`${x(0)},${y(min)} ${pts} ${x(data.length - 1)},${y(min)}`} fill={`url(#${id}a)`} />
          <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        {data.map((d, i) => i % every === 0 || i === data.length - 1 ? <text key={d.label + i} x={x(i)} y={H - 8} textAnchor={i === data.length - 1 ? "end" : "middle"} className="fill-text-tertiary text-[11px]">{d.label}</text> : null)}
        {hover !== null && <line x1={x(at)} x2={x(at)} y1={T} y2={H - B} className="stroke-text-tertiary" strokeWidth="1" strokeDasharray="3 4" />}
        <circle cx={x(at)} cy={y(cur.value)} r="10" className="fill-brand" fillOpacity="0.18" />
        <circle cx={x(at)} cy={y(cur.value)} r="5" className="fill-brand stroke-card" strokeWidth="2" />
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl bg-solid px-3 py-1.5 text-center text-on-solid" style={{ left: `${(x(at) / W) * 100}%`, top: `${(y(cur.value) / H) * 100 - 3}%` }}>
          <p className="text-[13px] font-bold tabular-nums">{format(cur.value)}</p>
          <p className="text-[11px] opacity-60">{cur.label}</p>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars with the value at the end. `warnBelow` paints low values in red. */
export function HBarList({ rows, max = 100, format = (v) => `${v}%`, warnBelow }: {
  rows: { label: string; value: number; hint?: string }[]; max?: number; format?: (v: number) => string; warnBelow?: number;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[96px_1fr_56px] items-center gap-3 text-sm sm:grid-cols-[140px_1fr_64px]">
          <span className="truncate font-medium" title={r.label}>{r.label}{r.hint && <span className="block text-xs text-text-tertiary">{r.hint}</span>}</span>
          <div className="h-3 overflow-hidden rounded-full bg-bg"><div className={cn("h-full rounded-full bg-solid", warnBelow !== undefined && r.value < warnBelow && "bg-danger")} style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }} /></div>
          <span className="text-right font-semibold tabular-nums">{format(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

const CELL: Record<DayMark, string> = { present: "bg-success/70", half: "bg-warning/80", absent: "bg-danger", leave: "bg-text-tertiary", holiday: "bg-fill", none: "bg-fill" };
const WORD: Record<DayMark, string> = { present: "present", half: "half day", absent: "absent", leave: "on leave", holiday: "holiday", none: "not marked" };

/** Students down, days across. Quick way to spot patterns and repeat absentees. */
export function Heatmap({ days, rows }: { days: string[]; rows: { name: string; marks: DayMark[] }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-1 text-xs">
        <thead><tr><th className="w-36" />{days.map((d) => <th key={d} className="font-normal tabular-nums text-text-tertiary">{Number(d.slice(8))}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="truncate pr-2 text-sm">{r.name}</td>
              {r.marks.map((m, i) => <td key={i}><div title={`${r.name}, ${days[i].slice(8)}: ${WORD[m]}`} aria-label={`${r.name} ${days[i]} ${WORD[m]}`} className={cn("h-6 rounded-md", CELL[m])} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(["present", "half", "absent", "leave"] as const).map((k) => <span key={k} className="flex items-center gap-1.5"><i className={cn("size-3 rounded", CELL[k])} />{WORD[k]}</span>)}
      </div>
    </div>
  );
}

/** Read-only stars, supports halves by fill ratio. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-separator" style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star className="fill-foreground text-foreground" style={{ width: size, height: size }} /></span>
          </span>
        );
      })}
    </span>
  );
}

/** Tappable 1-5 star input. Arrow keys work through the radio group. */
export function StarInput({ value, onChange, label, disabled }: { value: number; onChange: (v: number) => void; label: string; disabled?: boolean }) {
  const tr = useTr();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={i === 1 ? tr("star.one", "{n} star", { n: i }) : tr("star.many", "{n} stars", { n: i })} disabled={disabled}
          onClick={() => onChange(i)} className="grid size-10 place-items-center rounded-full hover:bg-fill disabled:hover:bg-transparent">
          <Star className={cn("size-7", i <= value ? "fill-foreground text-foreground" : "text-separator")} />
        </button>
      ))}
    </div>
  );
}
