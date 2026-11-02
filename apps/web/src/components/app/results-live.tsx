"use client";
import * as React from "react";
import { FileDown, Lock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Problem, ExcelButton } from "@/components/app/bits-a3";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { DateSheetTab, ExamsTab, GradingTab } from "@/components/app/results-live-setup";
import { useSession } from "@/components/session-provider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchReportCard, useClassSheet, useExamClasses, useExams, usePublish, useSaveMarks, useSaveRemarks, useUnpublish, type ClassSheet, type MarkEntry } from "@/lib/api/hooks/results";
import { errorText } from "@/lib/api/hooks/staff";
import { hasAccess } from "@/lib/permissions";
import { downloadReportCard } from "@/lib/report-card";
import { reportCardFromApi } from "@/lib/report-card-api";

/** Marks are numbers from 0 to max with at most two decimals; "A" means absent; empty clears the mark. undefined = invalid. */
type Parsed = { marks: number | null; absent: boolean };
function parseCell(raw: string, max: number): Parsed | undefined {
  const t = raw.trim();
  if (t === "") return { marks: null, absent: false };
  if (/^(a|ab|abs|absent)$/i.test(t)) return { marks: null, absent: true };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined;
  const n = Number(t);
  return n > max ? undefined : { marks: n, absent: false };
}

/** Results on the real API. Marks entry for the teacher, exams, grading and date sheet for academic managers. */
export function ResultsLive() {
  const { user } = useSession();
  const manager = hasAccess(user, "academic.manage");
  return (
    <>
      <PageHeader title="Marks." />
      <Tabs defaultValue="marks">
        <TabsList>
          <TabsTrigger value="marks">Marks</TabsTrigger>
          {manager && <TabsTrigger value="exams">Exams</TabsTrigger>}
          {manager && <TabsTrigger value="grading">Grading</TabsTrigger>}
          <TabsTrigger value="datesheet">Dates</TabsTrigger>
        </TabsList>
        <TabsContent value="marks"><MarksTab /></TabsContent>
        {manager && <TabsContent value="exams"><ExamsTab /></TabsContent>}
        {manager && <TabsContent value="grading"><GradingTab /></TabsContent>}
        <TabsContent value="datesheet"><DateSheetTab manager={manager} /></TabsContent>
      </Tabs>
    </>
  );
}

function MarksTab() {
  const exams = useExams();
  const [examSel, setExamSel] = React.useState("");
  const [classSel, setClassSel] = React.useState("");
  const list = exams.data?.items ?? [];
  const examId = list.find((e) => e.id === examSel)?.id ?? list.at(-1)?.id ?? null;
  const classes = useExamClasses(examId);
  const classId = classes.data?.find((c) => c.class_id === classSel)?.class_id ?? classes.data?.[0]?.class_id ?? null;
  const sheet = useClassSheet(examId, classId);

  if (exams.isError) return <ErrorBlock error={exams.error} onRetry={() => exams.refetch()} />;
  if (!exams.data) return <LoadingBlock label="Loading" />;
  if (!list.length) return <EmptyState icon={FileDown} title="No exam" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <NativeSelect aria-label="Exam" value={examId ?? ""} onChange={(e) => { setExamSel(e.target.value); setClassSel(""); }}>{list.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</NativeSelect>
        <NativeSelect aria-label="Class" value={classId ?? ""} disabled={!classes.data?.length} onChange={(e) => setClassSel(e.target.value)}>
          {(classes.data ?? []).map((c) => <option key={c.class_id} value={c.class_id}>Class {c.class_name}{c.published_at ? " · published" : ""}</option>)}
          {classes.data?.length === 0 && <option value="">No class</option>}
        </NativeSelect>
      </div>
      {classes.isError ? <ErrorBlock error={classes.error} onRetry={() => classes.refetch()} /> :
        classes.isPending ? <LoadingBlock label="Loading" /> :
        !classes.data.length ? <EmptyState icon={FileDown} title="No papers" /> :
        sheet.isError ? <ErrorBlock error={sheet.error} onRetry={() => sheet.refetch()} /> :
        !sheet.data ? <LoadingBlock label="Loading" /> :
        <SheetGrid key={`${examId}|${classId}`} sheet={sheet.data} examId={examId!} classId={classId!} status={classes.data.find((c) => c.class_id === classId)!} />}
    </div>
  );
}

function SheetGrid({ sheet, examId, classId, status }: { sheet: ClassSheet; examId: string; classId: string; status: { entered: number; expected: number; students: number } }) {
  const { user } = useSession();
  const isClassTeacher = hasAccess(user, "class_teacher", classId);
  const save = useSaveMarks(), saveRemarks = useSaveRemarks(), publish = usePublish(), unpublish = useUnpublish();
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [remarks, setRemarks] = React.useState<Record<string, string>>({});
  const [err, setErr] = React.useState<unknown>(null);
  const [bulk, setBulk] = React.useState<{ done: number; total: number } | null>(null);
  const [cardBusy, setCardBusy] = React.useState<string | null>(null);

  const original = React.useCallback((enr: string, subj: string) => {
    const c = sheet.students.find((s) => s.enrollment_id === enr)?.marks.find((m) => m.subject_id === subj);
    return c?.absent ? "A" : c?.marks_obtained != null ? String(c.marks_obtained) : "";
  }, [sheet]);
  const key = (enr: string, subj: string) => `${enr}|${subj}`;
  const editablePapers = sheet.papers.filter((p) => p.can_edit);
  const published = !!sheet.published_at;
  const changedKeys = Object.keys(draft).filter((k) => { const [e, s] = k.split("|"); return draft[k].trim() !== original(e, s); });
  const changedRemarks = Object.keys(remarks).filter((e) => remarks[e].trim() !== (sheet.students.find((s) => s.enrollment_id === e)?.remark ?? ""));
  const invalid = changedKeys.filter((k) => { const [, s] = k.split("|"); const p = sheet.papers.find((x) => x.subject_id === s); return !p || parseCell(draft[k], p.max_marks) === undefined; });
  const dirty = changedKeys.length + changedRemarks.length > 0;

  async function saveAll() {
    setErr(null);
    if (invalid.length) { toast.error("Fix the highlighted marks"); return; }
    try {
      if (changedKeys.length) {
        const entries: MarkEntry[] = changedKeys.map((k) => { const [enr, subj] = k.split("|"); const p = sheet.papers.find((x) => x.subject_id === subj)!; const v = parseCell(draft[k], p.max_marks)!; return { enrollment_id: enr, subject_id: subj, marks_obtained: v.marks, absent: v.absent }; });
        const r = await save.mutateAsync({ examId, classId, entries });
        toast.success(r.cleared ? `Saved, ${r.cleared} cleared` : "Saved");
      }
      if (changedRemarks.length) {
        await saveRemarks.mutateAsync({ examId, classId, remarks: changedRemarks.map((e) => ({ enrollment_id: e, remark: remarks[e].trim() })) });
        toast.success("Saved");
      }
      setDraft({}); setRemarks({});
    } catch (e) { setErr(e); }
  }

  async function openCard(studentId: string, name: string) {
    setCardBusy(studentId);
    try { downloadReportCard(reportCardFromApi(await fetchReportCard(examId, studentId))); toast.success("Downloaded"); }
    catch (e) { toast.error(errorText(e)); }
    finally { setCardBusy(null); }
  }
  async function allCards() {
    const list = sheet.students.filter((s) => s.marks.some((m) => m.entered));
    setBulk({ done: 0, total: list.length });
    try {
      for (let i = 0; i < list.length; i++) {
        downloadReportCard(reportCardFromApi(await fetchReportCard(examId, list[i].student_id)));
        setBulk({ done: i + 1, total: list.length });
        await new Promise((r) => setTimeout(r, 350));
      }
      toast.success(`${list.length} downloaded`);
    } catch (e) { toast.error(errorText(e)); } finally { setBulk(null); }
  }

  const togglePublish = () => {
    setErr(null);
    const done = (msg: string) => ({ onSuccess: () => toast.success(msg), onError: setErr });
    if (published) unpublish.mutate({ examId, classId }, done("Results hidden from parents again"));
    else publish.mutate({ examId, classId }, done("Published. Parents of the class can see the results."));
  };

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <p className="font-medium">{published ? "Visible to parents" : "Hidden from parents"}</p>
          <p className="text-[13px] text-muted-foreground">{status.entered}/{status.expected} entered</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ExcelButton path={`/exams/${examId}/classes/${classId}/export`} fallbackName="results.xlsx" />
          <Button variant="secondary" loading={bulk !== null} disabled={!sheet.students.some((s) => s.marks.some((m) => m.entered)) || dirty} onClick={allCards}>{bulk ? `Report cards ${bulk.done}/${bulk.total}` : <><FileDown /> Report cards</>}</Button>
          {isClassTeacher && <Button variant={published ? "secondary" : "brand"} loading={publish.isPending || unpublish.isPending} disabled={dirty} onClick={togglePublish}>{published ? "Unpublish" : "Publish"}</Button>}
          <Button variant="brand" loading={save.isPending || saveRemarks.isPending} disabled={!dirty} onClick={saveAll}>Save</Button>
        </div>
      </Card>
      <Problem error={err} />
      {editablePapers.length < sheet.papers.length && (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Lock className="size-3.5" /> {editablePapers.length === 0 ? "View only" : "Locked: other teachers"}</p>
      )}
      <Card className="overflow-x-auto p-0 sm:p-0">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Roll</TableHead><TableHead>Student</TableHead>
              {sheet.papers.map((p) => (
                <TableHead key={p.id} className="w-28"><span className="flex items-center gap-1">{!p.can_edit && <Lock className="size-3" aria-label="Not your subject" />}{p.subject}</span><span className="block text-[11px] font-normal text-text-tertiary">/{p.max_marks} · pass {p.pass_marks}</span></TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead><TableHead className="text-right">%</TableHead><TableHead>Grade</TableHead><TableHead className="text-right">Rank</TableHead>
              <TableHead className="min-w-40">Remark</TableHead><TableHead className="text-right"><span className="sr-only">Report card</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sheet.students.map((s) => (
              <TableRow key={s.enrollment_id}>
                <TableCell className="tabular-nums text-muted-foreground">{s.roll_no ?? "—"}</TableCell>
                <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><div className="min-w-28"><p className="font-medium">{s.name}</p><p className="text-xs text-text-tertiary">{s.scholar_no}</p></div></div></TableCell>
                {sheet.papers.map((p) => {
                  const k = key(s.enrollment_id, p.subject_id);
                  const cell = s.marks.find((m) => m.subject_id === p.subject_id);
                  const text = draft[k] ?? original(s.enrollment_id, p.subject_id);
                  const bad = k in draft && parseCell(text, p.max_marks) === undefined;
                  return (
                    <TableCell key={p.id}>
                      {p.can_edit ? (
                        <Input aria-label={`${p.subject} marks for ${s.name}`} inputMode="decimal" className="h-9 w-20" aria-invalid={bad} value={text} placeholder="—"
                          onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
                      ) : (
                        <span className={cell?.passed === false ? "text-danger" : ""}>{cell?.absent ? "A" : cell?.marks_obtained ?? "—"}</span>
                      )}
                      {bad && <p className="mt-1 text-[11px] text-danger">0–{p.max_marks} or A</p>}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right tabular-nums">{s.total}<span className="text-text-tertiary"> / {s.max_total}</span></TableCell>
                <TableCell className="text-right tabular-nums">{s.percentage ?? "—"}</TableCell>
                <TableCell>{s.grade ? <Badge tone={s.passed === false ? "danger" : s.complete ? "success" : "neutral"}>{s.grade}</Badge> : <span className="text-text-tertiary">—</span>}{!s.complete && s.marks.some((m) => m.entered) && <p className="mt-1 text-[11px] text-text-tertiary">Incomplete</p>}</TableCell>
                <TableCell className="text-right tabular-nums">{s.rank ?? "—"}</TableCell>
                <TableCell>
                  {isClassTeacher
                    ? <Input aria-label={`Remark for ${s.name}`} className="h-9" placeholder="Remark" maxLength={500} value={remarks[s.enrollment_id] ?? s.remark ?? ""} onChange={(e) => setRemarks((r) => ({ ...r, [s.enrollment_id]: e.target.value }))} />
                    : <span className="text-sm text-muted-foreground">{s.remark ?? "—"}</span>}
                </TableCell>
                <TableCell className="text-right"><Button size="icon-sm" variant="secondary" aria-label={`Report card of ${s.name}`} title="Report card (PDF)" loading={cardBusy === s.student_id} disabled={!s.marks.some((m) => m.entered) || dirty} onClick={() => openCard(s.student_id, s.name)}>{cardBusy !== s.student_id && <FileDown />}</Button></TableCell>
              </TableRow>
            ))}
            {sheet.students.length === 0 && <TableRow><TableCell colSpan={sheet.papers.length + 8} className="py-10 text-center text-muted-foreground">No students in this class.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <p className="text-xs text-text-tertiary">A = absent{sheet.grading.length ? ` · ${sheet.grading.map((b) => `${b.grade} ${b.min_percent}%+`).join(", ")}` : ""}</p>
    </>
  );
}
