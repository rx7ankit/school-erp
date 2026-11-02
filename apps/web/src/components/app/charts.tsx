import { Star } from "lucide-react";
import { useTr } from "@/lib/lang-context";
import type { DayMark } from "@/lib/parent-data";
import { cn } from "@/lib/utils";

/** Smooth-free line chart on one scale with a soft area and an emphasised last point. */
export function LineChart({ data, min = 0, max = 100, format = (v) => `${v}%`, label, height = 200 }: {
  data: { label: string; value: number }[]; min?: number; max?: number; format?: (v: number) => string; label: string; height?: number;
}) {
  const W = 640, H = height, L = 44, R = 12, T = 12, B = 28;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, data.length - 1);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const ticks = [0, 1, 2, 3, 4].map((i) => min + ((max - min) * i) / 4);
  const last = data[data.length - 1];
  const every = Math.ceil(data.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="1" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-text-tertiary text-[11px]">{format(Math.round(t))}</text>
        </g>
      ))}
      <polygon points={`${x(0)},${y(min)} ${pts} ${x(data.length - 1)},${y(min)}`} className="fill-foreground" fillOpacity="0.06" />
      <polyline points={pts} fill="none" className="stroke-foreground" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => i % every === 0 || i === data.length - 1 ? <text key={d.label + i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-text-tertiary text-[11px]">{d.label}</text> : null)}
      <circle cx={x(data.length - 1)} cy={y(last.value)} r="5" className="fill-brand" />
    </svg>
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
          <span className="truncate" title={r.label}>{r.label}{r.hint && <span className="block text-xs text-text-tertiary">{r.hint}</span>}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-fill"><div className={cn("h-full rounded-full bg-solid", warnBelow !== undefined && r.value < warnBelow && "bg-danger")} style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }} /></div>
          <span className="text-right tabular-nums">{format(r.value)}</span>
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
