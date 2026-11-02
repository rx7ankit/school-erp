import { useData, useLang, useTr } from "@/lib/lang-context";
import { clock } from "@/lib/exam-sheets";
import { PERIODS, WEEKDAYS, slotAt, staffName, substitutionFor, weekdayOf } from "@/lib/timetable";
import { cn } from "@/lib/utils";

/**
 * Weekly grid for one class: days across, periods down. Today's column is highlighted and today's
 * substitutes are shown. With `onEdit`, every cell is a button, so the grid works by keyboard.
 */
export function TimetableGrid({ classId, todayOn, onEdit }: { classId: string; todayOn: string; onEdit?: (weekday: number, periodId: string) => void }) {
  const tr = useTr(), d_ = useData(), lang = useLang();
  const todayWd = todayOn ? weekdayOf(todayOn) : -1;
  // Day names come from Intl so they follow the language (2024-01-01 was a Monday).
  const dayName = (n: number, style: "short" | "long", fallback: string) => lang === "en" ? fallback
    : new Intl.DateTimeFormat("hi-IN", { timeZone: "UTC", weekday: style }).format(new Date(Date.UTC(2024, 0, n)));
  return (
    <div className="overflow-x-auto rounded-[20px] bg-card p-2 sm:p-3" tabIndex={0} role="region" aria-label={tr("tt.region", "Weekly timetable, scrolls sideways")}>
      <table className="w-full min-w-[760px] border-separate border-spacing-1 text-left">
        <thead>
          <tr>
            <th scope="col" className="w-36 px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{tr("tt.period", "Period")}</th>
            {WEEKDAYS.map((d) => (
              <th key={d.n} scope="col" className={cn("rounded-xl px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary", d.n === todayWd && "bg-fill text-foreground")}>
                <abbr title={dayName(d.n, "long", d.long)} className="no-underline">{dayName(d.n, "short", d.short)}</abbr>{d.n === todayWd && <span className="ml-1.5 normal-case tracking-normal">· {tr("tt.today", "Today")}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => p.isBreak ? (
            <tr key={p.id}><th scope="row" className="px-3 py-1.5 text-xs font-medium text-text-tertiary">{clock(p.start)}</th>
              <td colSpan={WEEKDAYS.length} className="rounded-xl bg-fill py-1.5 text-center text-xs font-medium uppercase tracking-[0.1em] text-text-tertiary">{tr("tt.break", "Break")} · {clock(p.start)} – {clock(p.end)}</td></tr>
          ) : (
            <tr key={p.id}>
              <th scope="row" className="sticky left-0 z-[1] bg-card px-3 py-2 align-top"><span className="block text-sm font-bold">{d_(p.name)}</span><span className="block whitespace-nowrap text-xs font-normal tabular-nums text-text-tertiary">{clock(p.start)} – {clock(p.end)}</span></th>
              {WEEKDAYS.map((d) => {
                const slot = slotAt(classId, d.n, p.id);
                const sub = d.n === todayWd ? substitutionFor(todayOn, classId, p.id) : undefined;
                const body = (
                  <>
                    <span className={cn("block text-sm font-medium", !slot && "text-text-tertiary")}>{slot ? d_(slot.subject) : onEdit ? "Free" : "—"}</span>
                    {slot && <span className={cn("block truncate text-xs text-muted-foreground", sub && "line-through opacity-60")}>{staffName(slot.staffId)}</span>}
                    {sub && <span className="block truncate text-xs font-medium text-foreground">{tr("tt.sub", "Substitute: {name}", { name: staffName(sub.substituteStaffId) })}</span>}
                  </>
                );
                const cls = cn("block h-full min-h-14 w-full rounded-xl px-3 py-2 text-left align-top", d.n === todayWd ? "bg-fill/60" : "bg-background/40");
                return (
                  <td key={d.n} className="p-0 align-top">
                    {onEdit
                      ? <button type="button" onClick={() => onEdit(d.n, p.id)} aria-label={`${d.long} ${p.name}: ${slot ? `${slot.subject}, ${staffName(slot.staffId)}` : "free"}. Edit`} className={cn(cls, "hover:bg-separator/60")}>{body}</button>
                      : <div className={cls}>{body}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
