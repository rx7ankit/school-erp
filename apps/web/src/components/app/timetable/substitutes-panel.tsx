"use client";
import * as React from "react";
import { UserCheck } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { clock } from "@/lib/exam-sheets";
import { className } from "@/lib/mock";
import { PERIODS, assignSubstitute, freeTeachers, needsCover, removeSubstitute, staffName, subjectOf, weekdayOf, type CoverRow } from "@/lib/timetable";
import { usePending } from "@/lib/use-pending";

/** Periods that need cover today, with the free teachers for each. For staff.manage and admin. */
export function SubstitutesPanel({ todayOn }: { todayOn: string }) {
  if (!todayOn) return null;
  if (weekdayOf(todayOn) === 0) return <EmptyState icon={UserCheck} title="Sunday" />;
  const rows = needsCover(todayOn);
  if (rows.length === 0) return <EmptyState icon={UserCheck} title="No cover needed" />;
  const open = rows.filter((r) => !r.sub).length;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground"><b className="text-foreground">{open}</b> open</p>
      <ul className="flex flex-col gap-3">{rows.map((r) => <li key={`${r.slot.classId}-${r.slot.periodId}`}><CoverItem row={r} todayOn={todayOn} /></li>)}</ul>
    </div>
  );
}

function CoverItem({ row, todayOn }: { row: CoverRow; todayOn: string }) {
  const { slot, absent, sub } = row;
  const period = PERIODS.find((p) => p.id === slot.periodId)!;
  const free = freeTeachers(todayOn, slot.periodId);
  const [pick, setPick] = React.useState("");
  const chosen = free.some((t) => t.id === pick) ? pick : free[0]?.id ?? "";
  const { run, is } = usePending(500);
  const key = `${slot.classId}-${slot.periodId}`;
  return (
    <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <div className="w-32 shrink-0"><p className="font-bold">{period.name}</p><p className="text-xs tabular-nums text-text-tertiary">{clock(period.start)} – {clock(period.end)}</p></div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Class {className(slot.classId)} · {slot.subject}</p>
        <p className="text-sm text-muted-foreground">{absent.name}{absent.absentToday ? ` (${absent.absentToday})` : ""}</p>
      </div>
      {sub ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">{staffName(sub.substituteStaffId)}</Badge>
          <Button size="sm" variant="secondary" loading={is(key)} onClick={() => run(key, () => { removeSubstitute(todayOn, slot.classId, slot.periodId); toast.success("Substitute removed"); })}>Unassign</Button>
        </div>
      ) : free.length === 0 ? (
        <Badge tone="danger">No free teacher</Badge>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label={`Free teacher for ${period.name}, Class ${className(slot.classId)}`} className="w-56" value={chosen} onChange={(e) => setPick(e.target.value)}>
            {free.map((t) => <option key={t.id} value={t.id}>{t.name}{subjectOf(t) ? ` · ${subjectOf(t)}` : ""}</option>)}
          </NativeSelect>
          <Button size="sm" variant="brand" loading={is(key)} onClick={() => run(key, () => {
            assignSubstitute({ dateOn: todayOn, classId: slot.classId, periodId: slot.periodId, absentStaffId: absent.id, substituteStaffId: chosen });
            toast.success(`${staffName(chosen)} assigned`);
          })}>Assign</Button>
        </div>
      )}
    </Card>
  );
}
