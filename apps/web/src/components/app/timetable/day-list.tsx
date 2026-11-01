import { clock } from "@/lib/exam-sheets";
import { className } from "@/lib/mock";
import { nextRowIndex, type DayRow } from "@/lib/timetable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** A teacher's periods for one day. The period on now, or next, is highlighted when `now` is given. */
export function DayList({ rows, now = "", compact = false }: { rows: DayRow[]; now?: string; compact?: boolean }) {
  const next = nextRowIndex(rows, now);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => {
        const live = i === next, started = live && now >= r.period.start;
        return (
          <li key={`${r.period.id}-${r.classId}`} aria-current={live ? "true" : undefined}
            className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3", live ? "bg-brand/10" : "bg-fill/60", next > i && "opacity-60")}>
            <div className="w-28 shrink-0"><p className="text-sm font-bold">{r.period.name}</p><p className="text-xs tabular-nums text-text-tertiary">{clock(r.period.start)} – {clock(r.period.end)}</p></div>
            <div className="min-w-0 flex-1 basis-40">
              <p className="font-medium">{r.subject} <span className="font-normal text-muted-foreground">· Class {className(r.classId)}</span></p>
              {!compact && r.other && <p className="text-xs text-muted-foreground">{r.kind === "cover" ? `Covering for ${r.other}` : `Covered by ${r.other}`}</p>}
            </div>
            {live && <Badge tone="brand">{started ? "Now" : "Next"}</Badge>}
            {r.kind === "cover" && <Badge tone="warning">Substitute</Badge>}
          </li>
        );
      })}
    </ul>
  );
}
