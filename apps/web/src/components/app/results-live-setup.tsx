"use client";
import * as React from "react";
import { CalendarDays, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { Problem } from "@/components/app/bits-a3";
import { ErrorBlock, LoadingBlock, classLabel } from "@/components/app/academic-live-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClasses, useSubjects } from "@/lib/api/hooks/academic";
import type { ClassOut, SubjectOut } from "@/lib/api/types";
import {
  useActivateScheme, useAddExam, useAddSchedule, useAddScheme, useClassSheet, useDeleteExam, useDeleteSchedule, useEditExam, useEditScheme, useExamClasses, useExams, usePublishSchedule,
  useSchedule, useSchedules, useSchemes, useSetPapers, useSetSchedulePapers, type Exam, type Scheme, type ScheduleDetail,
} from "@/lib/api/hooks/results";
import { formatDateOn } from "@/lib/time";

const dates = (e: Pick<Exam, "starts_on" | "ends_on">) => (e.starts_on && e.ends_on ? `${formatDateOn(e.starts_on, "short")} to ${formatDateOn(e.ends_on)}` : e.starts_on ? `From ${formatDateOn(e.starts_on)}` : "No dates set");
/** "13:30:00" -> "1:30 pm" */
const clock = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };

/* ------------------------------------------------------------------ exams and papers */
export function ExamsTab() {
  const exams = useExams(), del = useDeleteExam();
  const [edit, setEdit] = React.useState<Exam | "new" | null>(null);
  const [papers, setPapers] = React.useState<Exam | null>(null);
  const [rm, setRm] = React.useState<Exam | null>(null);
  const [err, setErr] = React.useState<unknown>(null);
  if (exams.isError) return <ErrorBlock error={exams.error} onRetry={() => exams.refetch()} />;
  if (!exams.data) return <LoadingBlock label="Loading exams" />;
  return (
    <Card className="flex flex-col gap-5">
      <CardHeader className="mb-0"><div><CardTitle>Exams</CardTitle><CardDescription>Create the exam, then set its papers (subject, maximum and pass marks) for each class. Teachers then enter marks in the Marks tab.</CardDescription></div>
        <Button variant="brand" onClick={() => setEdit("new")}><Plus /> New exam</Button></CardHeader>
      {exams.data.items.length === 0 ? <EmptyState icon={ListChecks} title="No exams yet" text="Add an exam such as Unit Test 1 or Half-yearly." /> : (
        <Table>
          <TableHeader><TableRow><TableHead>Exam</TableHead><TableHead>Dates</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {exams.data.items.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.name}</TableCell><TableCell className="text-muted-foreground">{dates(e)}</TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setPapers(e)}>Papers</Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${e.name}`} onClick={() => setEdit(e)}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${e.name}`} onClick={() => { setErr(null); setRm(e); }}><Trash2 /></Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent>{edit && <ExamForm key={edit === "new" ? "new" : edit.id} exam={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}</DialogContent></Dialog>
      <Dialog open={!!papers} onOpenChange={(o) => !o && setPapers(null)}><DialogContent className="max-w-2xl">{papers && <PapersForm key={papers.id} exam={papers} onClose={() => setPapers(null)} />}</DialogContent></Dialog>
      <Dialog open={!!rm} onOpenChange={(o) => !o && setRm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {rm?.name}?</DialogTitle><DialogDescription>Its papers and any marks entered are removed. An exam with published results cannot be deleted.</DialogDescription></DialogHeader>
          <Problem error={err} />
          <DialogFooter><Button variant="secondary" onClick={() => setRm(null)}>Keep it</Button><Button variant="destructive" loading={del.isPending} onClick={() => rm && del.mutate(rm.id, { onSuccess: () => { toast.success("Exam deleted"); setRm(null); }, onError: setErr })}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ExamForm({ exam, onClose }: { exam: Exam | null; onClose: () => void }) {
  const add = useAddExam(), edit = useEditExam();
  const [name, setName] = React.useState(exam?.name ?? "");
  const [from, setFrom] = React.useState(exam?.starts_on ?? "");
  const [to, setTo] = React.useState(exam?.ends_on ?? "");
  const [err, setErr] = React.useState<unknown>(null);
  const pending = add.isPending || edit.isPending;
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault(); setErr(null);
      const body = { name: name.trim(), starts_on: from || null, ends_on: to || null };
      const opts = { onSuccess: () => { toast.success(exam ? "Exam saved" : "Exam created"); onClose(); }, onError: setErr };
      if (exam) edit.mutate({ id: exam.id, ...body }, opts); else add.mutate(body, opts);
    }}>
      <DialogHeader><DialogTitle>{exam ? "Edit exam" : "New exam"}</DialogTitle><DialogDescription>For the current academic year.</DialogDescription></DialogHeader>
      <Field label="Name" htmlFor="en"><Input id="en" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Unit Test 1" autoFocus /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts on" htmlFor="es"><Input id="es" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Ends on" htmlFor="ee"><Input id="ee" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <Problem error={err} />
      <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={pending} disabled={!name.trim()}>{exam ? "Save" : "Create exam"}</Button></DialogFooter>
    </form>
  );
}

interface PaperDraft { subject_id: string; max: string; pass: string }
/** Waits for what is already set (the classes with papers and the papers of the first of them), then shows the form. */
function PapersForm({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const classes = useClasses(), subjects = useSubjects(), withPapers = useExamClasses(exam.id);
  const firstWith = withPapers.data?.[0]?.class_id ?? null;
  const sheet = useClassSheet(exam.id, firstWith);
  const err = classes.error ?? subjects.error ?? withPapers.error ?? sheet.error;
  if (err) return <ErrorBlock error={err} onRetry={() => { classes.refetch(); subjects.refetch(); withPapers.refetch(); sheet.refetch(); }} />;
  if (!classes.data || !subjects.data || !withPapers.data || (firstWith && !sheet.data)) return <LoadingBlock label="Loading" />;
  const rows: PaperDraft[] = sheet.data ? sheet.data.papers.map((p) => ({ subject_id: p.subject_id, max: String(p.max_marks), pass: String(p.pass_marks) })) : [{ subject_id: "", max: "100", pass: "" }];
  return <PapersFormBody exam={exam} onClose={onClose} classes={classes.data.items} subjects={subjects.data.items} initialClasses={withPapers.data.map((c) => c.class_id)} initialRows={rows} />;
}

function PapersFormBody({ exam, onClose, classes, subjects, initialClasses, initialRows }: {
  exam: Exam; onClose: () => void; classes: ClassOut[]; subjects: SubjectOut[]; initialClasses: string[]; initialRows: PaperDraft[];
}) {
  const set = useSetPapers();
  const [picked, setPicked] = React.useState<string[]>(initialClasses);
  const [rows, setRows] = React.useState<PaperDraft[]>(initialRows);
  const [err, setErr] = React.useState<unknown>(null);
  const num = (s: string) => (/^\d{1,4}$/.test(s.trim()) ? Number(s) : null);
  const problems = rows.some((r) => !r.subject_id || !num(r.max) || (r.pass.trim() !== "" && (num(r.pass) === null || num(r.pass)! > num(r.max)!))) || new Set(rows.map((r) => r.subject_id)).size !== rows.length;
  const upd = (i: number, p: Partial<PaperDraft>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault(); setErr(null);
      set.mutate({ examId: exam.id, class_ids: picked, papers: rows.map((r) => ({ subject_id: r.subject_id, max_marks: num(r.max)!, pass_marks: r.pass.trim() ? num(r.pass) : null })) }, { onSuccess: () => { toast.success("Papers saved"); onClose(); }, onError: setErr });
    }}>
      <DialogHeader><DialogTitle>Papers of {exam.name}</DialogTitle><DialogDescription>The same papers are set for every class you tick. This replaces what those classes have now. Leave pass marks empty for 33% of the maximum.</DialogDescription></DialogHeader>
      <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-medium">Classes</legend>
        <div className="flex flex-wrap gap-2">{classes.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm"><Checkbox checked={picked.includes(c.id)} onCheckedChange={(v) => setPicked((p) => v === true ? [...p, c.id] : p.filter((x) => x !== c.id))} />{classLabel(c)}</label>
        ))}</div>
      </fieldset>
      <div className="flex max-h-[34vh] flex-col gap-2 overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_90px_auto] items-center gap-2">
            <NativeSelect aria-label="Subject" value={r.subject_id} onChange={(e) => upd(i, { subject_id: e.target.value })}><option value="">Subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect>
            <Input aria-label="Maximum marks" inputMode="numeric" placeholder="Max" value={r.max} onChange={(e) => upd(i, { max: e.target.value })} />
            <Input aria-label="Pass marks" inputMode="numeric" placeholder="Pass" value={r.pass} onChange={(e) => upd(i, { pass: e.target.value })} />
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove paper" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
      </div>
      <div><Button type="button" variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { subject_id: "", max: "100", pass: "" }])}><Plus /> Add paper</Button></div>
      {problems && rows.length > 0 && <p className="text-sm text-danger">Each paper needs a different subject and a maximum. Pass marks cannot be above the maximum.</p>}
      <Problem error={err} />
      <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={set.isPending} disabled={!picked.length || problems}>Save papers</Button></DialogFooter>
    </form>
  );
}

/* ------------------------------------------------------------------ grading */
export function GradingTab() {
  const schemes = useSchemes(), activate = useActivateScheme();
  const [edit, setEdit] = React.useState<Scheme | "new" | null>(null);
  if (schemes.isError) return <ErrorBlock error={schemes.error} onRetry={() => schemes.refetch()} />;
  if (!schemes.data) return <LoadingBlock label="Loading grading" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">The active scheme turns percentages into grades on every result sheet and report card.</p>
        <Button variant="brand" onClick={() => setEdit("new")}><Plus /> New scheme</Button>
      </div>
      {schemes.data.length === 0 && <EmptyState icon={ListChecks} title="No grading scheme yet" text="Add one, for example A1 from 91%, A2 from 81%, and so on, and make it active." />}
      <div className="grid gap-4 md:grid-cols-2">
        {schemes.data.map((s) => (
          <Card key={s.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3"><p className="text-[17px] font-bold">{s.name}</p>{s.is_active ? <Badge tone="success">Active</Badge> : <Badge>Not active</Badge>}</div>
            <ul className="flex flex-wrap gap-2">{[...s.bands].sort((a, b) => b.min_percent - a.min_percent).map((b) => <li key={b.grade} className="rounded-full bg-fill px-3 py-1 text-sm"><b>{b.grade}</b> <span className="text-muted-foreground">from {b.min_percent}%</span></li>)}</ul>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEdit(s)}><Pencil /> Edit</Button>
              {!s.is_active && <Button size="sm" variant="brand" loading={activate.isPending && activate.variables === s.id} onClick={() => activate.mutate(s.id, { onSuccess: () => toast.success(`${s.name} is now active`), onError: (e) => toast.error(e.message) })}>Make active</Button>}
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}><DialogContent className="max-w-lg">{edit && <SchemeForm key={edit === "new" ? "new" : edit.id} scheme={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}</DialogContent></Dialog>
    </div>
  );
}

function SchemeForm({ scheme, onClose }: { scheme: Scheme | null; onClose: () => void }) {
  const add = useAddScheme(), edit = useEditScheme();
  const [name, setName] = React.useState(scheme?.name ?? "");
  const [bands, setBands] = React.useState<{ min: string; grade: string }[]>(scheme ? [...scheme.bands].sort((a, b) => b.min_percent - a.min_percent).map((b) => ({ min: String(b.min_percent), grade: b.grade })) : [{ min: "90", grade: "A" }, { min: "75", grade: "B" }, { min: "60", grade: "C" }, { min: "40", grade: "D" }, { min: "0", grade: "E" }]);
  const [active, setActive] = React.useState(false);
  const [err, setErr] = React.useState<unknown>(null);
  const pct = (s: string) => (/^\d{1,3}$/.test(s.trim()) && Number(s) <= 100 ? Number(s) : null);
  const bad = !name.trim() || bands.length === 0 || bands.some((b) => pct(b.min) === null || !b.grade.trim()) || new Set(bands.map((b) => b.grade.trim())).size !== bands.length;
  const upd = (i: number, p: Partial<{ min: string; grade: string }>) => setBands((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => {
      e.preventDefault(); setErr(null);
      const b = bands.map((x) => ({ min_percent: pct(x.min)!, grade: x.grade.trim() }));
      const opts = { onSuccess: () => { toast.success("Grading scheme saved"); onClose(); }, onError: setErr };
      if (scheme) edit.mutate({ id: scheme.id, name: name.trim(), bands: b }, opts); else add.mutate({ name: name.trim(), bands: b, make_active: active }, opts);
    }}>
      <DialogHeader><DialogTitle>{scheme ? "Edit grading scheme" : "New grading scheme"}</DialogTitle><DialogDescription>A student gets the grade of the highest band their percentage reaches. Include a band from 0%.</DialogDescription></DialogHeader>
      <Field label="Name" htmlFor="gn"><Input id="gn" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
      <div className="flex max-h-[32vh] flex-col gap-2 overflow-y-auto">
        {bands.map((b, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <Input aria-label="From percent" inputMode="numeric" placeholder="From %" value={b.min} onChange={(e) => upd(i, { min: e.target.value })} />
            <Input aria-label="Grade" placeholder="Grade" maxLength={10} value={b.grade} onChange={(e) => upd(i, { grade: e.target.value })} />
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove band" onClick={() => setBands((r) => r.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
      </div>
      <div><Button type="button" size="sm" variant="secondary" onClick={() => setBands((r) => [...r, { min: "", grade: "" }])}><Plus /> Add band</Button></div>
      {!scheme && <label className="flex cursor-pointer items-center gap-2 text-sm"><Switch checked={active} onCheckedChange={setActive} />Make this the active scheme</label>}
      <Problem error={err} />
      <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={add.isPending || edit.isPending} disabled={bad}>Save</Button></DialogFooter>
    </form>
  );
}

/* ------------------------------------------------------------------ date sheet */
export function DateSheetTab({ manager }: { manager: boolean }) {
  const list = useSchedules(), del = useDeleteSchedule();
  const [open, setOpen] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  if (list.isError) return <ErrorBlock error={list.error} onRetry={() => list.refetch()} />;
  if (!list.data) return <LoadingBlock label="Loading date sheets" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">{manager ? "Build the paper schedule, then publish it. Parents of the classes see published date sheets in their app." : "Published exam date sheets."}</p>
        {manager && <Button variant="brand" onClick={() => setAdding(true)}><Plus /> New date sheet</Button>}
      </div>
      {list.data.length === 0 && <EmptyState icon={CalendarDays} title="No date sheet yet" text={manager ? "Create one for an exam and add each paper's class, subject, date and time." : "Nothing has been published yet."} />}
      <div className="grid gap-4 md:grid-cols-2">
        {list.data.map((s) => (
          <Card key={s.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3"><p className="text-[17px] font-bold">{s.name}</p>{s.published_at ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>}</div>
            <p className="text-[13px] text-muted-foreground">{s.papers} {s.papers === 1 ? "paper" : "papers"}</p>
            <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setOpen(s.id)}>{manager ? "Open and edit" : "View"}</Button>
              {manager && <Button size="icon-sm" variant="ghost" aria-label={`Delete ${s.name}`} disabled={del.isPending} onClick={() => del.mutate(s.id, { onSuccess: () => toast.success("Date sheet deleted"), onError: (e) => toast.error(e.message) })}><Trash2 /></Button>}</div>
          </Card>
        ))}
      </div>
      <Dialog open={adding} onOpenChange={setAdding}><DialogContent>{adding && <NewSheet onClose={() => setAdding(false)} onCreated={setOpen} />}</DialogContent></Dialog>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}><DialogContent className="max-w-3xl">{open && <SheetEditor key={open} id={open} manager={manager} onClose={() => setOpen(null)} />}</DialogContent></Dialog>
    </div>
  );
}

function NewSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const exams = useExams(), add = useAddSchedule();
  const [name, setName] = React.useState("");
  const [examId, setExamId] = React.useState("");
  const [err, setErr] = React.useState<unknown>(null);
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); setErr(null); add.mutate({ name: name.trim(), exam_id: examId || null }, { onSuccess: (s) => { toast.success("Date sheet created"); onClose(); onCreated(s.id); }, onError: setErr }); }}>
      <DialogHeader><DialogTitle>New date sheet</DialogTitle><DialogDescription>You add the papers next.</DialogDescription></DialogHeader>
      <Field label="Name" htmlFor="dn"><Input id="dn" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Half-yearly date sheet" autoFocus /></Field>
      <Field label="For exam (optional)" htmlFor="de"><NativeSelect id="de" value={examId} onChange={(e) => setExamId(e.target.value)}><option value="">Not linked to an exam</option>{exams.data?.items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect></Field>
      <Problem error={err} />
      <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={add.isPending} disabled={!name.trim()}>Create</Button></DialogFooter>
    </form>
  );
}

interface PaperRow { class_id: string; subject_id: string; paper_on: string; starts_at: string }
function SheetEditor({ id, manager, onClose }: { id: string; manager: boolean; onClose: () => void }) {
  const q = useSchedule(id), classes = useClasses(), subjects = useSubjects();
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingBlock label="Loading date sheet" />;
  return <SheetEditorBody sheet={q.data} manager={manager} onClose={onClose} classes={classes.data?.items ?? []} subjects={subjects.data?.items ?? []} />;
}
function SheetEditorBody({ sheet: s, manager, onClose, classes, subjects }: { sheet: ScheduleDetail; manager: boolean; onClose: () => void; classes: ClassOut[]; subjects: SubjectOut[] }) {
  const id = s.id;
  const save = useSetSchedulePapers(), pub = usePublishSchedule();
  const [rows, setRows] = React.useState<PaperRow[]>(() => s.items.map((i) => ({ class_id: i.class_id, subject_id: i.subject_id, paper_on: i.paper_on, starts_at: i.starts_at.slice(0, 5) })));
  const [err, setErr] = React.useState<unknown>(null);
  const published = !!s.published_at;
  const upd = (i: number, p: Partial<PaperRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const incomplete = rows.some((r) => !r.class_id || !r.subject_id || !r.paper_on || !r.starts_at);
  return (
    <div className="flex flex-col gap-4">
      <DialogHeader><DialogTitle>{s.name}</DialogTitle><DialogDescription>{published ? "Published: parents can see it." : "Draft: only academic managers can see it."} Dates and times are IST.</DialogDescription></DialogHeader>
      {manager ? (
        <>
          <div className="flex max-h-[44vh] flex-col gap-2 overflow-y-auto">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_150px_120px_auto]">
                <NativeSelect aria-label="Class" value={r.class_id} onChange={(e) => upd(i, { class_id: e.target.value })}><option value="">Class</option>{classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</NativeSelect>
                <NativeSelect aria-label="Subject" value={r.subject_id} onChange={(e) => upd(i, { subject_id: e.target.value })}><option value="">Subject</option>{subjects.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
                <Input aria-label="Date" type="date" value={r.paper_on} onChange={(e) => upd(i, { paper_on: e.target.value })} />
                <Input aria-label="Start time" type="time" value={r.starts_at} onChange={(e) => upd(i, { starts_at: e.target.value })} />
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove paper" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            {rows.length === 0 && <p className="text-sm text-muted-foreground">No papers yet.</p>}
          </div>
          <div><Button type="button" size="sm" variant="secondary" onClick={() => setRows((r) => [...r, { class_id: r.at(-1)?.class_id ?? "", subject_id: "", paper_on: r.at(-1)?.paper_on ?? "", starts_at: r.at(-1)?.starts_at ?? "09:00" }])}><Plus /> Add paper</Button></div>
        </>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Class</TableHead><TableHead>Subject</TableHead></TableRow></TableHeader>
          <TableBody>{s.items.map((i, k) => <TableRow key={k}><TableCell>{formatDateOn(i.paper_on, "weekday")}</TableCell><TableCell>{clock(i.starts_at)}</TableCell><TableCell>{i.class_name}</TableCell><TableCell>{i.subject}</TableCell></TableRow>)}</TableBody>
        </Table>
      )}
      <Problem error={err} />
      {manager && (
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="secondary" loading={pub.isPending} onClick={() => { setErr(null); pub.mutate({ id, publish: !published }, { onSuccess: () => toast.success(published ? "Unpublished" : "Published. Parents can see it."), onError: setErr }); }}>{published ? "Unpublish" : "Publish"}</Button>
          <Button variant="brand" loading={save.isPending} disabled={incomplete} onClick={() => { setErr(null); save.mutate({ id, papers: rows }, { onSuccess: () => toast.success("Papers saved"), onError: setErr }); }}>Save papers</Button>
        </DialogFooter>
      )}
    </div>
  );
}
