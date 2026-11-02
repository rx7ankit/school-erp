"use client";
import * as React from "react";
import { UserCheck, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { clock, weekdayOf } from "@/components/app/timetable-live-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { errorText } from "@/lib/api/hooks/staff";
import { useAbsences, useAssignSubstitute, useCover, useFreeTeachers, useMarkAbsent, useRemoveAbsence, useRemoveSubstitution, useTeacherOptions, type CoverRow } from "@/lib/api/hooks/timetable";
import { formatDateOn } from "@/lib/time";

/** Absent teachers and the periods that need cover on one day, with free teachers to pick from. For staff.manage and admin. */
export function CoverTab({ today }: { today: string }) {
  const [day, setDay] = React.useState(today);
  const absences = useAbsences(day, true);
  const cover = useCover(day, true);
  const teachers = useTeacherOptions(true);
  const mark = useMarkAbsent(), unmark = useRemoveAbsence();
  const [who, setWho] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const absentIds = new Set((absences.data?.items ?? []).map((a) => a.staff_id));
  const options = teachers.data.filter((t) => !absentIds.has(t.id));
  const chosen = options.some((t) => t.id === who) ? who : options[0]?.id ?? "";
  const rows = cover.data ?? [];
  const open = rows.filter((r) => !r.substitution_id).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!chosen) return;
    setErr(null);
    mark.mutate({ staff_id: chosen, absent_on: day, reason: reason.trim() || null }, {
      onSuccess: (a) => { setReason(""); toast.success(`${a.staff_name} marked absent`, { description: a.slots_to_cover ? `${a.slots_to_cover} ${a.slots_to_cover === 1 ? "period needs" : "periods need"} cover.` : "No periods that day." }); },
      onError: (x) => setErr(errorText(x)),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Day" type="date" className="w-44" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        {day !== today && <Button variant="ghost" size="sm" onClick={() => setDay(today)}>Today</Button>}
        <span className="text-sm text-muted-foreground">{formatDateOn(day, "weekday")}</span>
      </div>

      <Card>
        <CardHeader><CardTitle>Teachers absent</CardTitle></CardHeader>
        <form onSubmit={submit} className="mb-4 flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="Teacher" className="w-56" value={chosen} onChange={(e) => setWho(e.target.value)} disabled={teachers.isPending}>
            {options.length === 0 && <option value="">No one to add</option>}
            {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
          <Input aria-label="Reason (optional)" className="min-w-48 flex-1" placeholder="Reason (optional)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="brand" loading={mark.isPending} disabled={!chosen}>Mark absent</Button>
        </form>
        {err && <p role="alert" className="mb-3 text-sm text-danger">{err}</p>}
        {absences.isPending ? <LoadingBlock /> : absences.isError ? <ErrorBlock error={absences.error} onRetry={() => absences.refetch()} /> : absences.data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is marked absent on this day.</p>
        ) : (
          <ul className="flex flex-col gap-2">{absences.data.items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-fill/60 px-4 py-3">
              <div className="min-w-0 flex-1 basis-40"><p className="font-medium">{a.staff_name}</p>{a.reason && <p className="text-xs text-muted-foreground">{a.reason}</p>}</div>
              <Badge tone={a.slots_to_cover === 0 || a.slots_covered === a.slots_to_cover ? "success" : "warning"}>{a.slots_covered} of {a.slots_to_cover} covered</Badge>
              <Button size="sm" variant="secondary" loading={unmark.isPending && unmark.variables === a.id} onClick={() => unmark.mutate(a.id, { onSuccess: () => toast.success(`${a.staff_name} is back`, { description: "Any substitutes for that day were cancelled." }), onError: (x) => toast.error(errorText(x)) })}>
                {!(unmark.isPending && unmark.variables === a.id) && <UserMinus />}Not absent
              </Button>
            </li>
          ))}</ul>
        )}
      </Card>

      {weekdayOf(day) === 0 ? <EmptyState icon={UserCheck} title="No classes on Sunday" text="Cover is planned on school days." /> : cover.isPending ? <LoadingBlock /> : cover.isError ? <ErrorBlock error={cover.error} onRetry={() => cover.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={UserCheck} title="Nothing needs cover" text="No absent teacher has a period on this day." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground"><b className="text-foreground">{open}</b> of {rows.length} periods still need a teacher.</p>
          <ul className="flex flex-col gap-3">{rows.map((r) => <li key={`${r.slot.id}`}><CoverItem row={r} day={day} /></li>)}</ul>
        </>
      )}
    </div>
  );
}

function CoverItem({ row, day }: { row: CoverRow; day: string }) {
  const { slot } = row;
  const free = useFreeTeachers(day, slot.period_id, !row.substitution_id);
  const assign = useAssignSubstitute(), unassign = useRemoveSubstitution();
  const [pick, setPick] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const list = free.data ?? [];
  const chosen = list.some((t) => t.staff_id === pick) ? pick : list[0]?.staff_id ?? "";
  return (
    <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <div className="w-32 shrink-0"><p className="font-bold">{slot.period_name}</p><p className="text-xs tabular-nums text-text-tertiary">{clock(slot.starts_at)} – {clock(slot.ends_at)}</p></div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Class {slot.class_label} · {slot.subject_name}</p>
        <p className="text-sm text-muted-foreground">{slot.staff_name} is absent</p>
        {err && <p role="alert" className="mt-1 text-xs text-danger">{err}</p>}
      </div>
      {row.substitution_id ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Covered by {row.substitute_name}</Badge>
          <Button size="sm" variant="secondary" loading={unassign.isPending} onClick={() => unassign.mutate(row.substitution_id!, { onSuccess: () => toast.success("Substitute removed"), onError: (x) => setErr(errorText(x)) })}>Unassign</Button>
        </div>
      ) : free.isPending ? <Badge>Finding free teachers</Badge> : free.isError ? (
        <Button size="sm" variant="secondary" onClick={() => free.refetch()}>Try again</Button>
      ) : list.length === 0 ? <Badge tone="danger">No free teacher</Badge> : (
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label={`Free teacher for ${slot.period_name}, Class ${slot.class_label}`} className="w-56" value={chosen} onChange={(e) => setPick(e.target.value)}>
            {list.map((t) => <option key={t.staff_id} value={t.staff_id}>{t.name}</option>)}
          </NativeSelect>
          <Button size="sm" variant="brand" loading={assign.isPending} onClick={() => { setErr(null); assign.mutate({ slot_id: slot.id, covers_on: day, substitute_staff_id: chosen }, {
            onSuccess: (s) => toast.success(`${s.substitute_name} will cover ${slot.period_name}`, { description: `Class ${slot.class_label}. They see it in My day.` }),
            onError: (x) => setErr(errorText(x)),
          }); }}>Assign</Button>
        </div>
      )}
    </Card>
  );
}
