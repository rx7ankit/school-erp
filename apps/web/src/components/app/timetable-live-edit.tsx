"use client";
import * as React from "react";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorBlock, LoadingBlock, classLabel } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { WeekGrid, WD, clock, hhmm } from "@/components/app/timetable-live-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAssignmentRows, useClasses, useSubjects } from "@/lib/api/hooks/academic";
import { errorText } from "@/lib/api/hooks/staff";
import { useAddPeriod, useAddSlot, useClassTimetable, useDeletePeriod, useDeleteSlot, useEditPeriod, useEditSlot, usePeriods, useTeacherOptions, type PeriodOut, type SlotOut } from "@/lib/api/hooks/timetable";
import { ApiError } from "@/lib/api/client";

interface Cell { weekday: number; period: PeriodOut; slot?: SlotOut }

/** Weekly timetable of one class. With `canEdit` every cell opens the editor. */
export function ClassTimetableTab({ canEdit, canListStaff, todayWd, defaultClassId }: { canEdit: boolean; canListStaff: boolean; todayWd: number; defaultClassId?: string }) {
  const classes = useClasses();
  const [picked, setPicked] = React.useState("");
  const list = classes.data?.items ?? [];
  const classId = list.some((c) => c.id === picked) ? picked : (list.find((c) => c.id === defaultClassId) ?? list[0])?.id ?? "";
  const tt = useClassTimetable(classId);
  const [cell, setCell] = React.useState<Cell | null>(null);
  if (classes.isPending) return <LoadingBlock />;
  if (classes.isError) return <ErrorBlock error={classes.error} onRetry={() => classes.refetch()} />;
  if (list.length === 0) return <EmptyState icon={Clock} title="No classes yet" text="Add classes in Academic first." />;
  const periods = tt.data?.periods ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NativeSelect aria-label="Class" className="w-40" value={classId} onChange={(e) => setPicked(e.target.value)}>
          {list.map((c) => <option key={c.id} value={c.id}>Class {classLabel(c)}</option>)}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">{canEdit ? "Select a period to set its subject and teacher." : "Only the academic team can change the timetable."}</p>
      </div>
      {tt.isPending ? <LoadingBlock /> : tt.isError ? <ErrorBlock error={tt.error} onRetry={() => tt.refetch()} /> : periods.length === 0 ? (
        <EmptyState icon={Clock} title="No periods set up" text={canEdit ? "Add the school's periods in the Periods tab, then build each class timetable." : "The academic team has not set up periods yet."} />
      ) : (
        <WeekGrid periods={periods} slots={tt.data?.slots ?? []} show={(s) => s.staff_name} todayWd={todayWd} onCell={canEdit ? (weekday, period, slot) => setCell({ weekday, period, slot }) : undefined} />
      )}
      <Dialog open={!!cell} onOpenChange={(o) => !o && setCell(null)}>
        <DialogContent>{cell && <CellEditor key={`${cell.weekday}-${cell.period.id}`} classId={classId} cell={cell} canListStaff={canListStaff} onClose={() => setCell(null)} />}</DialogContent>
      </Dialog>
    </div>
  );
}

function CellEditor({ classId, cell, canListStaff, onClose }: { classId: string; cell: Cell; canListStaff: boolean; onClose: () => void }) {
  const classes = useClasses(), subjects = useSubjects(), assignments = useAssignmentRows(), teachers = useTeacherOptions(canListStaff);
  const add = useAddSlot(), edit = useEditSlot(), del = useDeleteSlot();
  const cls = classes.data?.items.find((c) => c.id === classId);
  const subs = (subjects.data?.items ?? []).filter((s) => cls?.subject_ids.includes(s.id) ?? true);
  const [subject, setSubject] = React.useState(cell.slot?.subject_id ?? "");
  const [staff, setStaff] = React.useState(cell.slot?.staff_id ?? "");
  const [err, setErr] = React.useState<ApiError | string | null>(null);
  const day = WD.find((d) => d.n === cell.weekday)?.long;
  const pending = add.isPending || edit.isPending || del.isPending;
  const loading = classes.isPending || subjects.isPending || teachers.isPending;

  // Picking a subject suggests its teacher in this class, when the academic setup names one.
  const onSubject = (id: string) => {
    setSubject(id); setErr(null);
    const t = (assignments.data?.items ?? []).find((a) => a.class_id === classId && a.subject_id === id);
    if (t && !cell.slot) setStaff(t.staff_id);
  };
  const done = (msg: string) => () => { onClose(); toast.success(msg); };
  const fail = (e: unknown) => setErr(e instanceof ApiError ? e : errorText(e));
  function save() {
    setErr(null);
    if (!subject || !staff) return setErr("Choose a subject and a teacher.");
    if (cell.slot) edit.mutate({ id: cell.slot.id, subject_id: subject, staff_id: staff }, { onSuccess: done("Period updated"), onError: fail });
    else add.mutate({ class_id: classId, weekday: cell.weekday, period_id: cell.period.id, subject_id: subject, staff_id: staff }, { onSuccess: done("Period added"), onError: fail });
  }
  const conflict = err instanceof ApiError && ["class_busy", "teacher_busy"].includes(err.code);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{day} · {cell.period.name}</DialogTitle>
        <DialogDescription>Class {cls ? classLabel(cls) : ""} · {clock(cell.period.starts_at)} – {clock(cell.period.ends_at)}</DialogDescription>
      </DialogHeader>
      {loading ? <LoadingBlock /> : (
        <div className="flex flex-col gap-4">
          <Field label="Subject" htmlFor="tt-subject">
            <NativeSelect id="tt-subject" value={subject} onChange={(e) => onSubject(e.target.value)}>
              <option value="">Choose a subject</option>
              {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
            {cls && cls.subject_ids.length === 0 && <p className="text-xs text-text-tertiary">This class has no subjects yet. Add them in Academic.</p>}
          </Field>
          <Field label="Teacher" htmlFor="tt-teacher">
            <NativeSelect id="tt-teacher" value={staff} onChange={(e) => { setStaff(e.target.value); setErr(null); }}>
              <option value="">Choose a teacher</option>
              {teachers.data.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </NativeSelect>
          </Field>
          {err && <p role="alert" className={conflict ? "rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger" : "text-sm text-danger"}>{typeof err === "string" ? err : errorText(err)}</p>}
        </div>
      )}
      <DialogFooter>
        {cell.slot && <Button variant="secondary" className="mr-auto" loading={del.isPending} disabled={pending && !del.isPending} onClick={() => del.mutate(cell.slot!.id, { onSuccess: done("Period removed"), onError: fail })}>{!del.isPending && <Trash2 />}Remove</Button>}
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="brand" loading={add.isPending || edit.isPending} disabled={loading || del.isPending} onClick={save}>Save</Button>
      </DialogFooter>
    </>
  );
}

/* ---------------------------------------------------------------- periods */
export function PeriodsTab({ canEdit }: { canEdit: boolean }) {
  const q = usePeriods();
  const [form, setForm] = React.useState<PeriodOut | "new" | null>(null);
  const [del, setDel] = React.useState<PeriodOut | null>(null);
  const remove = useDeletePeriod();
  const periods = [...(q.data ?? [])].sort((a, b) => a.number - b.number);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">The bell schedule every class timetable uses.{canEdit ? "" : " Only the academic team can change it."}</p>
        {canEdit && <Button variant="brand" onClick={() => setForm("new")}><Plus /> Add period</Button>}
      </div>
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : periods.length === 0 ? (
        <EmptyState icon={Clock} title="No periods yet" text="Add Period 1, Period 2 and so on with their start and end times." />
      ) : (
        <Card className="p-2 sm:p-3">
          <ul>{periods.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-card-hover">
              <span className="grid size-8 place-items-center rounded-full bg-fill text-sm font-bold tabular-nums">{p.number}</span>
              <div className="min-w-0 flex-1"><p className="font-medium">{p.name}</p><p className="text-sm tabular-nums text-muted-foreground">{clock(p.starts_at)} – {clock(p.ends_at)}</p></div>
              {canEdit && <><Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`} onClick={() => setForm(p)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={`Delete ${p.name}`} onClick={() => { remove.reset(); setDel(p); }}><Trash2 /></Button></>}
            </li>
          ))}</ul>
        </Card>
      )}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>{form && <PeriodForm key={form === "new" ? "new" : form.id} period={form === "new" ? null : form} next={(periods.at(-1)?.number ?? 0) + 1} onDone={() => setForm(null)} />}</DialogContent>
      </Dialog>
      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {del?.name}?</DialogTitle><DialogDescription>Only a period no class timetable uses can be deleted.</DialogDescription></DialogHeader>
          {remove.isError && <p role="alert" className="text-sm text-danger">{errorText(remove.error)}</p>}
          <DialogFooter><Button variant="secondary" onClick={() => setDel(null)}>Keep</Button>
            <Button variant="destructive" loading={remove.isPending} onClick={() => del && remove.mutate(del.id, { onSuccess: () => { setDel(null); toast.success("Period deleted"); } })}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PeriodForm({ period, next, onDone }: { period: PeriodOut | null; next: number; onDone: () => void }) {
  const add = useAddPeriod(), edit = useEditPeriod();
  const [err, setErr] = React.useState<string | null>(null);
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { number: Number(f.get("number")), name: String(f.get("name")).trim(), starts_at: String(f.get("start")), ends_at: String(f.get("end")) };
    const cb = { onSuccess: () => { onDone(); toast.success(period ? "Period updated" : "Period added"); }, onError: (x: unknown) => setErr(errorText(x)) };
    setErr(null);
    if (period) edit.mutate({ id: period.id, body }, cb); else add.mutate(body, cb);
  }
  return (
    <>
      <DialogHeader><DialogTitle>{period ? "Edit period" : "Add period"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[96px_1fr] gap-3">
          <Field label="Number" htmlFor="p-number"><Input id="p-number" name="number" type="number" min={1} max={20} required defaultValue={period?.number ?? next} /></Field>
          <Field label="Name" htmlFor="p-name"><Input id="p-name" name="name" required maxLength={50} defaultValue={period?.name ?? `Period ${next}`} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="p-start"><Input id="p-start" name="start" type="time" required defaultValue={period ? hhmm(period.starts_at) : ""} /></Field>
          <Field label="Ends" htmlFor="p-end"><Input id="p-end" name="end" type="time" required defaultValue={period ? hhmm(period.ends_at) : ""} /></Field>
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <DialogFooter><Button type="button" variant="secondary" onClick={onDone}>Cancel</Button><Button type="submit" variant="brand" loading={add.isPending || edit.isPending}>{period ? "Save" : "Add"}</Button></DialogFooter>
      </form>
    </>
  );
}
