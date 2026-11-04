"use client";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DayEntry, PeriodOut, SlotOut } from "@/lib/api/hooks/timetable";
import { cn } from "@/lib/utils";

export const WD = [{ n: 1, short: "Mon", long: "Monday" }, { n: 2, short: "Tue", long: "Tuesday" }, { n: 3, short: "Wed", long: "Wednesday" }, { n: 4, short: "Thu", long: "Thursday" }, { n: 5, short: "Fri", long: "Friday" }, { n: 6, short: "Sat", long: "Saturday" }];

/** "08:40:00" -> "8:40 am". Period times are school clock times, never zone-converted. */
export function clock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
/** Value for <input type="time"> and the API: "HH:MM". */
export const hhmm = (t: string) => t.slice(0, 5);
export const weekdayOf = (dateOn: string) => new Date(`${dateOn}T00:00:00Z`).getUTCDay();

/**
 * Weekly grid, days across and periods down. `show` picks the second line of a lesson (the teacher in a class
 * timetable, the class in a teacher's). With `onCell` every cell is a button, so it works by keyboard.
 */
export function WeekGrid({ periods, slots, show, todayWd, onCell, emptyText = "—" }: {
  periods: PeriodOut[]; slots: SlotOut[]; show: (s: SlotOut) => string; todayWd?: number;
  onCell?: (weekday: number, period: PeriodOut, slot?: SlotOut) => void; emptyText?: string;
}) {
  const at = (wd: number, pid: string) => slots.find((s) => s.weekday === wd && s.period_id === pid);
  return (
    <div className="overflow-x-auto rounded-[20px] bg-card p-2 sm:p-3" tabIndex={0} role="region" aria-label="Weekly timetable, scrolls sideways">
      <table className="w-full min-w-[760px] border-separate border-spacing-1 text-left">
        <thead>
          <tr>
            <th scope="col" className="w-36 px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Period</th>
            {WD.map((d) => (
              <th key={d.n} scope="col" className={cn("rounded-xl px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary", d.n === todayWd && "bg-fill text-foreground")}>
                <abbr title={d.long} className="no-underline">{d.short}</abbr>{d.n === todayWd && <span className="sr-only"> (today)</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.id}>
              <th scope="row" className="sticky left-0 z-[1] bg-card px-3 py-2 align-top"><span className="block text-sm font-bold">{p.name}</span><span className="block whitespace-nowrap text-xs font-normal tabular-nums text-text-tertiary">{clock(p.starts_at)} – {clock(p.ends_at)}</span></th>
              {WD.map((d) => {
                const slot = at(d.n, p.id);
                const body = (
                  <>
                    <span className={cn("block text-sm font-medium", !slot && "text-text-tertiary")}>{slot ? slot.subject_name : onCell ? "Free" : emptyText}</span>
                    {slot && <span className="block truncate text-xs text-muted-foreground">{show(slot)}</span>}
                  </>
                );
                const cls = cn("block h-full min-h-14 w-full rounded-xl px-3 py-2 text-left align-top", d.n === todayWd ? "bg-fill" : "bg-background/40");
                return (
                  <td key={d.n} className="p-0 align-top">
                    {onCell
                      ? <button type="button" onClick={() => onCell(d.n, p, slot)} aria-label={`${d.long} ${p.name}: ${slot ? `${slot.subject_name}, ${slot.staff_name}` : "free"}. Edit`} className={cn(cls, "hover:bg-separator/60")}>{body}</button>
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

/** One teacher's day from /timetable/me/day. */
export function DayEntries({ entries, nowHm }: { entries: DayEntry[]; nowHm: string }) {
  const sorted = [...entries].sort((a, b) => a.slot.starts_at.localeCompare(b.slot.starts_at));
  const next = sorted.findIndex((e) => e.role !== "covered" && hhmm(e.slot.ends_at) > nowHm);
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((e, i) => {
        const live = i === next && !!nowHm, started = live && nowHm >= hhmm(e.slot.starts_at);
        return (
          <li key={`${e.slot.id}-${e.role}`} aria-current={live ? "true" : undefined}
            className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3", live ? "bg-fill" : "bg-fill/60", e.role === "covered" && "opacity-60")}>
            <div className="w-28 shrink-0"><p className="text-sm font-bold">{e.slot.period_name}</p><p className="text-xs tabular-nums text-text-tertiary">{clock(e.slot.starts_at)} – {clock(e.slot.ends_at)}</p></div>
            <div className="min-w-0 flex-1 basis-40">
              <p className="font-medium">{e.slot.subject_name} <span className="font-normal text-muted-foreground">· Class {e.slot.class_label}</span></p>
              {e.role === "covering" && e.absent_staff_name && <p className="text-xs text-muted-foreground">For {e.absent_staff_name}</p>}
              {e.role === "covered" && e.substitute_name && <p className="text-xs text-muted-foreground">By {e.substitute_name}</p>}
            </div>
            {live && <Badge tone="brand">{started ? "Now" : "Next"}</Badge>}
            {e.role === "covering" && <Badge tone="warning">Cover</Badge>}
            {e.role === "covered" && <Badge>Covered</Badge>}
          </li>
        );
      })}
    </ul>
  );
}

/** Loading twin of WeekGrid: same frame, real day headings, lesson-sized blocks. */
export function SkWeekGrid({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="overflow-x-auto rounded-[20px] bg-card p-2 sm:p-3">
      <span className="sr-only">Loading</span>
      <table aria-hidden="true" className="w-full min-w-[760px] border-separate border-spacing-1 text-left">
        <thead>
          <tr>
            <th scope="col" className="w-36 px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Period</th>
            {WD.map((d) => <th key={d.n} scope="col" className="rounded-xl px-3 py-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{d.short}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <th scope="row" className="px-3 py-2 align-top"><Skeleton className="h-4 w-16" /><Skeleton className="mt-1.5 h-3 w-24" /></th>
              {WD.map((d) => <td key={d.n} className="p-0 align-top"><div className="min-h-14 rounded-xl bg-background/40 px-3 py-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="mt-1.5 h-3 w-3/5" /></div></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Loading twin of DayEntries. */
export function SkDayEntries({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-fill/60 px-4 py-3">
          <div className="w-28 shrink-0"><Skeleton className="h-4 w-16" /><Skeleton className="mt-1.5 h-3 w-24" /></div>
          <div className="min-w-0 flex-1 basis-40"><Skeleton className="h-4 w-1/2" /></div>
        </li>
      ))}
    </ul>
  );
}
