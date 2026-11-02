"use client";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { classLabel, saveExam, useAcademic, validateExam, type Exam, type ExamSubject } from "@/lib/academic-setup";
import { usePending } from "@/lib/use-pending";

const TERMS = ["Term 1", "Term 2", "Term 3"];
interface Line { on: boolean; max: string; pass: string; }

/** Create or edit an exam: name, term, dates, classes and per-subject max and pass marks. */
export function ExamDialog({ exam, onClose }: { exam: Exam | "new"; onClose: () => void }) {
  const { classes, subjects, classSubjects } = useAcademic();
  const { run, is } = usePending(700);
  const editing = exam === "new" ? null : exam;
  const [name, setName] = React.useState(editing?.name ?? "");
  const [term, setTerm] = React.useState(editing?.term ?? "Term 1");
  const [fromOn, setFromOn] = React.useState(editing?.fromOn ?? "");
  const [toOn, setToOn] = React.useState(editing?.toOn ?? "");
  const [classIds, setClassIds] = React.useState<string[]>(editing?.classIds ?? []);
  const [lines, setLines] = React.useState<Record<string, Line>>(() => Object.fromEntries(subjects.map((s) => {
    const es = editing?.subjects.find((x) => x.subjectId === s.id);
    return [s.id, { on: editing ? !!es : true, max: String(es?.max ?? 100), pass: String(es?.pass ?? 40) }];
  })));
  const [error, setError] = React.useState("");

  // Subjects that at least one chosen class studies.
  const offered = subjects.filter((s) => classIds.some((c) => (classSubjects[c] ?? []).includes(s.id)));

  function build(): Omit<Exam, "id"> & { id?: string } {
    const rows: ExamSubject[] = classIds.flatMap((classId) => offered.filter((s) => lines[s.id]?.on && (classSubjects[classId] ?? []).includes(s.id))
      .map((s) => ({ classId, subjectId: s.id, max: Number(lines[s.id].max), pass: Number(lines[s.id].pass) })));
    return { id: editing?.id, name, term, fromOn, toOn, classIds, subjects: rows };
  }
  const setLine = (id: string, patch: Partial<Line>) => setLines((l) => ({ ...l, [id]: { ...l[id], ...patch } }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "New exam"}</DialogTitle>
          <DialogDescription className="sr-only">Exam details.</DialogDescription>
        </DialogHeader>
        <form className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1" onSubmit={(e) => {
          e.preventDefault();
          const draft = build(); const msg = validateExam(draft);
          if (msg) { setError(msg); return; }
          setError("");
          run("exam", () => { saveExam(draft); toast.success(editing ? "Saved" : "Exam added"); onClose(); });
        }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="en"><Input id="en" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Term" htmlFor="et"><NativeSelect id="et" value={term} onChange={(e) => setTerm(e.target.value)}>{TERMS.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Field>
            <Field label="From" htmlFor="ef"><Input id="ef" type="date" value={fromOn} onChange={(e) => setFromOn(e.target.value)} required /></Field>
            <Field label="To" htmlFor="el"><Input id="el" type="date" value={toOn} onChange={(e) => setToOn(e.target.value)} required /></Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Classes</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm">
                  <Checkbox checked={classIds.includes(c.id)} onCheckedChange={(on) => setClassIds((p) => (on === true ? [...p, c.id] : p.filter((x) => x !== c.id)))} />Class {classLabel(c.id)}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Subjects</legend>
            {offered.length === 0 ? <p className="rounded-xl bg-fill px-4 py-3 text-sm text-muted-foreground">Choose a class.</p> : (
              <div className="flex flex-col gap-2">
                {offered.map((s) => (
                  <div key={s.id} className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-2 sm:grid-cols-[1fr_7rem_7rem]">
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={lines[s.id]?.on ?? false} onCheckedChange={(on) => setLine(s.id, { on: on === true })} />{s.name}</label>
                    <Input aria-label={`${s.name} maximum marks`} inputMode="numeric" className="h-9" placeholder="Max" disabled={!lines[s.id]?.on} value={lines[s.id]?.max ?? ""} onChange={(e) => setLine(s.id, { max: e.target.value })} />
                    <Input aria-label={`${s.name} pass marks`} inputMode="numeric" className="h-9" placeholder="Pass" disabled={!lines[s.id]?.on} value={lines[s.id]?.pass ?? ""} onChange={(e) => setLine(s.id, { pass: e.target.value })} />
                  </div>
                ))}
              </div>
            )}
          </fieldset>
          {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={is("exam")}>{editing ? "Save exam" : "Create exam"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
