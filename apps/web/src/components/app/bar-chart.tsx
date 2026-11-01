import { cn } from "@/lib/utils";

/** Flat bar chart on one scale. The last bar is highlighted. Labels name real values only. */
export function BarChart({ data, format, ticks = 4, height = 220, label }: {
  data: { label: string; value: number }[]; format: (v: number) => string; ticks?: number; height?: number; label: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  // Round the top tick up to a clean number so every tick label is a value the axis really reaches.
  const pow = 10 ** Math.floor(Math.log10(max / ticks));
  const step = Math.ceil(max / ticks / pow) * pow;
  const top = step * ticks;
  return (
    <div role="img" aria-label={label} className="grid grid-cols-[48px_1fr] gap-2" style={{ height }}>
      <div className="flex flex-col-reverse justify-between pb-6 text-right text-xs tabular-nums text-text-tertiary">
        {Array.from({ length: ticks + 1 }, (_, i) => <span key={i}>{format(step * i)}</span>)}
      </div>
      <div className="relative flex items-end gap-2 pb-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col-reverse justify-between" aria-hidden>
          {Array.from({ length: ticks + 1 }, (_, i) => <span key={i} className="h-px w-full bg-border" />)}
        </div>
        {data.map((d, i) => (
          <div key={d.label} className="relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className={cn("w-full rounded-t-lg bg-fill hover:bg-separator", i === data.length - 1 && "bg-brand hover:bg-brand")} style={{ height: `${(d.value / top) * 100}%` }} />
            <span className={cn("absolute -bottom-6 left-0 right-0 text-center text-xs text-text-tertiary", i === data.length - 1 && "font-medium text-foreground")}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
