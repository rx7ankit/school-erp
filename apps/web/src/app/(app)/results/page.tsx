"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { NoAccess } from "@/components/app/no-access";
import { EmptyState } from "@/components/app/empty-state";
import { GradeLegend } from "@/components/app/academic/grade-legend";
import { ReportCardButton } from "@/components/app/academic/report-card-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/components/session-provider";
import { STUDENTS } from "@/lib/mock";
import { classIdsFor, hasAccess } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { classLabel, examSubjectsFor, examsForClass, gradeFor, markOf, publicationOf, remarkOf, saveMarks, setPublished, setRemark, subjectName, useAcademic } from "@/lib/academic-setup";
import { buildReportCardData, downloadReportCard } from "@/lib/report-card";
import { nowUTC } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { isLive } from "@/lib/api/config";
import { ResultsLive } from "@/components/app/results-live";

/** Marks are numbers from 0 to max, with at most one decimal. Returns the number, null when empty, or undefined when invalid. */
function parseMarks(raw: string, max: number): number | null | undefined {
  if (raw.trim() === "") return null;
  if (!/^\d+(\.\d)?$/.test(raw.trim())) return undefined;
  const n = Number(raw);
  return n > max ? undefined : n;
}

export default function ResultsPage() {
  const { user } = useSession();
  if (isLive) return hasAccess(user, "assigned_class") || hasAccess(user, "academic.manage") ? <ResultsLive /> : <NoAccess need="a class assignment or the Academic permission" />;
  return <ResultsDemo />;
}

function ResultsDemo() {
  const { user } = useSession();
  const store = useAcademic();
  const { run, is } = usePending(600);
  const mine = user ? classIdsFor(user, "class_teacher", store.classes.map((c) => c.id)) : [];
  const [classId, setClassId] = React.useState(mine[0] ?? "");
  const [examSel, setExamSel] = React.useState("");
  const [subjectSel, setSubjectSel] = React.useState("");
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [bulk, setBulk] = React.useState<{ done: number; total: number } | null>(null);
  if (!hasAccess(user, "class_teacher")) return <NoAccess need="class teacher access" />;

  const exams = examsForClass(classId);
  const exam = exams.find((e) => e.id === examSel) ?? exams[0];
  const subs = exam ? examSubjectsFor(exam.id, classId) : [];
  const sub = subs.find((s) => s.subjectId === subjectSel) ?? subs[0];
  const students = STUDENTS.filter((s) => s.classId === classId && s.status === "active");
  const pub = exam ? publicationOf(exam.id, classId) : undefined;
  const key = (studentId: string) => `${exam?.id}|${sub?.subjectId}|${studentId}`;
  const shown = (studentId: string) => draft[key(studentId)] ?? (sub && exam ? String(markOf(exam.id, sub.subjectId, studentId) ?? "") : "");
  const hasMarks = (studentId: string) => !!exam && subs.some((s) => markOf(exam.id, s.subjectId, studentId) !== undefined);
  const withMarks = students.filter((s) => hasMarks(s.id));
  const dirty = Object.keys(draft).length > 0;

  function save() {
    if (!exam) return;
    const entries: { examId: string; subjectId: string; studentId: string; marks: number | null }[] = [];
    for (const [k, raw] of Object.entries(draft)) {
      const [examId, subjectId, studentId] = k.split("|");
      const max = examSubjectsFor(examId, classId).find((s) => s.subjectId === subjectId)?.max ?? 0;
      const v = parseMarks(raw, max);
      if (v === undefined) { toast.error(`Fix the marks for ${STUDENTS.find((s) => s.id === studentId)?.name ?? "a student"} first`, { description: `Marks must be between 0 and ${max}.` }); return; }
      entries.push({ examId, subjectId, studentId, marks: v });
    }
    run("save", () => { saveMarks(entries); setDraft({}); logAudit({ category: "academic", action: "marks.saved", summary: `Saved ${entries.length} marks for Class ${classLabel(classId)}, ${exam.name}`, entity: `Class ${classLabel(classId)}`, href: "/results" }); toast.success("Marks saved"); });
  }

  async function downloadAll() {
    if (!exam) return;
    setBulk({ done: 0, total: withMarks.length });
    try {
      for (let i = 0; i < withMarks.length; i++) {
        const data = buildReportCardData(withMarks[i].id, exam.id);
        if (data) downloadReportCard(data);
        setBulk({ done: i + 1, total: withMarks.length });
        await new Promise((r) => setTimeout(r, 350));
      }
      toast.success(`${withMarks.length} report cards downloaded`);
    } catch { toast.error("Could not create all report cards. Try again."); }
    finally { setBulk(null); }
  }

  const sheetRows = () => students.map((s) => {
    const n = sub && exam ? markOf(exam.id, sub.subjectId, s.id) : undefined;
    return [s.rollNo, s.name, n ?? null, n === undefined || !sub ? "" : gradeFor((n / sub.max) * 100), exam ? remarkOf(exam.id, s.id) : ""];
  });

  return (
    <>
      <PageHeader eyebrow="Class teacher" title="Results." dim="Enter marks once."
        actions={<>
          {exam && sub && <ExportButton fileName={`results-${classLabel(classId)}-${subjectName(sub.subjectId)}`} build={() => [{ name: `Class ${classLabel(classId)}`, headers: ["Roll", "Student", `${subjectName(sub.subjectId)} marks (of ${sub.max})`, "Grade", "Remark"], rows: sheetRows() }]} />}
          <Button variant="secondary" loading={bulk !== null} disabled={!withMarks.length || dirty} onClick={downloadAll}>{bulk ? `Report cards ${bulk.done}/${bulk.total}` : <><FileDown /> Download all report cards</>}</Button>
          <Button variant="brand" loading={is("save")} disabled={!dirty} onClick={save}>Save marks</Button></>} />
      {mine.length === 0 || !exam ? (
        <EmptyState icon={FileDown} title="No exam for this class yet" text="Ask the academic manager to create an exam for your class in Academic, Exams." />
      ) : (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div><p className="font-medium">{pub ? "Visible to parents" : "Hidden from parents"}</p>
              <p className="text-[13px] text-muted-foreground">{pub ? `Parents of Class ${classLabel(classId)} can see ${exam.name} and download report cards.` : "Parents see results only after you publish. You can unpublish any time."}</p></div>
            <div className="flex items-center gap-3"><Label htmlFor="pub">Publish to parents</Label>
              <Switch id="pub" checked={!!pub} onCheckedChange={(on) => {
                if (on && !withMarks.length) { toast.error("Enter and save marks before publishing"); return; }
                setPublished(exam.id, classId, on, nowUTC());
                if (on) notify(students.map((s) => ({ type: "result" as const, studentId: s.id, params: { title: exam.name } })));
                logAudit({ category: "academic", action: on ? "results.published" : "results.unpublished", summary: `${on ? "Published" : "Unpublished"} ${exam.name} results for Class ${classLabel(classId)}`, entity: `Class ${classLabel(classId)}`, href: "/results", sensitive: !on });
                toast.success(on ? "Published. Parents are notified." : "Results hidden again");
              }} /></div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <NativeSelect aria-label="Class" value={classId} onChange={(e) => { setClassId(e.target.value); setExamSel(""); setSubjectSel(""); setDraft({}); }}>{mine.map((id) => <option key={id} value={id}>Class {classLabel(id)}</option>)}</NativeSelect>
            <NativeSelect aria-label="Exam" value={exam.id} onChange={(e) => { setExamSel(e.target.value); setSubjectSel(""); setDraft({}); }}>{exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</NativeSelect>
            <NativeSelect aria-label="Subject" value={sub?.subjectId ?? ""} onChange={(e) => setSubjectSel(e.target.value)}>{subs.map((s) => <option key={s.subjectId} value={s.subjectId}>{subjectName(s.subjectId)}</option>)}</NativeSelect>
          </div>
          {!sub ? <EmptyState icon={FileDown} title="This exam has no subjects for the class" text="Add subjects to the exam in Academic, Exams." /> : (
            <Card>
              <Table>
                <TableHeader><TableRow><TableHead>Student</TableHead><TableHead className="w-36">Marks (of {sub.max})</TableHead><TableHead className="w-24">Grade</TableHead><TableHead>Remark for report</TableHead><TableHead className="w-40 text-right"><span className="sr-only">Report card</span></TableHead></TableRow></TableHeader>
                <TableBody>
                  {students.map((s) => {
                    const raw = shown(s.id), v = parseMarks(raw, sub.max), invalid = v === undefined;
                    return (
                      <TableRow key={s.id}>
                        <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><span className="font-medium">{s.name}</span></div></TableCell>
                        <TableCell><Input aria-label={`Marks for ${s.name}`} inputMode="decimal" className="h-9 w-24" aria-invalid={invalid} value={raw}
                          onChange={(e) => setDraft((d) => ({ ...d, [key(s.id)]: e.target.value }))} /></TableCell>
                        <TableCell>{typeof v === "number" ? <Badge tone={v >= sub.pass ? "success" : "danger"}>{gradeFor((v / sub.max) * 100)}</Badge> : invalid ? <span className="text-xs text-danger">0 to {sub.max}</span> : <span className="text-text-tertiary">—</span>}</TableCell>
                        <TableCell><Input aria-label={`Remark for ${s.name}`} className="h-9" placeholder="Optional" value={remarkOf(exam.id, s.id)} onChange={(e) => setRemark(exam.id, s.id, e.target.value)} /></TableCell>
                        <TableCell className="text-right"><ReportCardButton studentId={s.id} examId={exam.id} disabled={!hasMarks(s.id)} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="mt-4 text-xs text-text-tertiary">Pass mark for {subjectName(sub.subjectId)} is {sub.pass} of {sub.max}. Report cards use saved marks.</p>
            </Card>
          )}
          <GradeLegend />
        </>
      )}
    </>
  );
}
