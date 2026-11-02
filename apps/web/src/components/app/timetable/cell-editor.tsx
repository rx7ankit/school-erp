"use client";
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { SUBJECTS_ALL, className } from "@/lib/mock";
import { PERIODS, WEEKDAYS, clashes, setSlot, slotAt, staffName, subjectOf, teachers } from "@/lib/timetable";
import { usePending } from "@/lib/use-pending";

export interface CellRef { classId: string; weekday: number; periodId: string; }

/** Edit one timetable cell. Warns, but does not block, when the teacher already has that period elsewhere. */
export function CellEditor({ cell, onClose }: { cell: CellRef | null; onClose: () => void }) {
  return (
    <Dialog open={!!cell} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{cell && <CellForm key={`${cell.classId}-${cell.weekday}-${cell.periodId}`} cell={cell} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function CellForm({ cell, onClose }: { cell: CellRef; onClose: () => void }) {
  const cur = slotAt(cell.classId, cell.weekday, cell.periodId);
  const [subject, setSubject] = React.useState(cur?.subject ?? SUBJECTS_ALL[0]);
  const [staffId, setStaffId] = React.useState(cur?.staffId ?? teachers().find((t) => subjectOf(t) === (cur?.subject ?? SUBJECTS_ALL[0]))?.id ?? teachers()[0]?.id ?? "");
  const { run, is } = usePending(500);
  const day = WEEKDAYS.find((d) => d.n === cell.weekday)!.long, period = PERIODS.find((p) => p.id === cell.periodId)!;
  const clash = staffId ? clashes(staffId, cell.weekday, cell.periodId, cell.classId) : [];
  return (
    <>
      <DialogHeader><DialogTitle>Class {className(cell.classId)} · {period.name}</DialogTitle><DialogDescription>{day}</DialogDescription></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); run("save", () => { setSlot(cell.classId, cell.weekday, cell.periodId, { subject, staffId }); toast.success("Saved"); onClose(); }); }} className="flex flex-col gap-4">
        <Field label="Subject" htmlFor="tt-subject">
          <NativeSelect id="tt-subject" value={subject} onChange={(e) => { setSubject(e.target.value); const t = teachers().find((x) => subjectOf(x) === e.target.value); if (t) setStaffId(t.id); }}>
            {SUBJECTS_ALL.map((s) => <option key={s} value={s}>{s}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Teacher" htmlFor="tt-teacher">
          <NativeSelect id="tt-teacher" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {teachers().map((t) => <option key={t.id} value={t.id}>{t.name} · {subjectOf(t) ?? t.designation}</option>)}
          </NativeSelect>
        </Field>
        {clash.length > 0 && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-sm text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>Also in Class {clash.map((c) => className(c.classId)).join(", ")}</span>
          </p>
        )}
        <DialogFooter>
          {cur && <Button type="button" variant="ghost" className="mr-auto" loading={is("clear")} onClick={() => run("clear", () => { setSlot(cell.classId, cell.weekday, cell.periodId, null); toast.success("Cleared"); onClose(); })}>Clear</Button>}
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="brand" loading={is("save")} disabled={!staffId}>Save</Button>
        </DialogFooter>
      </form>
    </>
  );
}
