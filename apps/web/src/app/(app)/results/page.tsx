"use client";
import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { NoAccess } from "@/components/app/no-access";
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
import { CLASSES, EXAMS, STUDENTS, SUBJECTS, className } from "@/lib/mock";
import { classIdsFor, hasAccess } from "@/lib/permissions";
import { notify } from "@/lib/notifications";

const MAX = 100;
const grade = (m: number) => (m >= 90 ? "A+" : m >= 80 ? "A" : m >= 70 ? "B" : m >= 60 ? "C" : m >= 40 ? "D" : "E");

export default function ResultsPage() {
  const { user } = useSession();
  const mine = user ? classIdsFor(user, "class_teacher", CLASSES.map((c) => c.id)) : [];
  const [classId, setClassId] = React.useState(mine[0] ?? "");
  const [exam, setExam] = React.useState(EXAMS[0].id);
  const [subject, setSubject] = React.useState(SUBJECTS[0]);
  const [marks, setMarks] = React.useState<Record<string, string>>({});
  const [published, setPublished] = React.useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = React.useState<Record<string, string>>({});
  if (!hasAccess(user, "class_teacher")) return <NoAccess need="class teacher access" />;
  const students = STUDENTS.filter((s) => s.classId === classId && s.status === "active");
  const pubKey = `${exam}|${classId}`;
  const isPub = !!published[pubKey];
  const key = (id: string) => `${exam}|${subject}|${id}`;

  return (
    <>
      <PageHeader eyebrow="Class teacher" title="Results." dim="Enter marks once."
        actions={<><ExportButton fileName={`results-${className(classId)}-${subject}`} build={() => [{ name: `Class ${className(classId)}`, headers: ["Roll", "Student", `${subject} marks (of ${MAX})`, "Grade", "Remark"],
            rows: students.map((s) => { const raw = marks[key(s.id)] ?? "", n = Number(raw); return [s.rollNo, s.name, raw === "" || Number.isNaN(n) ? null : n, raw === "" || Number.isNaN(n) ? "" : grade(n), remarks[`${exam}|${s.id}`] ?? ""]; }) }]} />
          <Button variant="secondary" onClick={() => toast.success("Marks saved")}>Save marks</Button></>} />
      <Card className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div><p className="font-medium">{isPub ? "Visible to parents" : "Hidden from parents"}</p>
          <p className="text-[13px] text-muted-foreground">{isPub ? `Parents of Class ${className(classId)} can see this exam in the app.` : "Parents see results only after you publish. You can unpublish any time."}</p></div>
        <div className="flex items-center gap-3"><Label htmlFor="pub">Publish to parents</Label>
          <Switch id="pub" checked={isPub} onCheckedChange={(on) => { setPublished((p) => ({ ...p, [pubKey]: on })); if (on) notify(students.map((s) => ({ type: "result" as const, studentId: s.id, params: { title: EXAMS.find((x) => x.id === exam)?.name ?? "" } }))); toast.success(on ? "Published. Parents are notified." : "Results hidden again"); }} /></div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <NativeSelect aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>{mine.map((id) => <option key={id} value={id}>Class {className(id)}</option>)}</NativeSelect>
        <NativeSelect aria-label="Exam" value={exam} onChange={(e) => setExam(e.target.value)}>{EXAMS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</NativeSelect>
        <NativeSelect aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</NativeSelect>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Student</TableHead><TableHead className="w-36">Marks (of {MAX})</TableHead><TableHead className="w-24">Grade</TableHead><TableHead>Remark for report</TableHead></TableRow></TableHeader>
          <TableBody>
            {students.map((s) => {
              const raw = marks[key(s.id)] ?? "";
              const n = Number(raw);
              const invalid = raw !== "" && (Number.isNaN(n) || n < 0 || n > MAX);
              return (
                <TableRow key={s.id}>
                  <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><span className="font-medium">{s.name}</span></div></TableCell>
                  <TableCell><Input aria-label={`Marks for ${s.name}`} inputMode="numeric" className="h-9 w-24" aria-invalid={invalid} value={raw}
                    onChange={(e) => setMarks((m) => ({ ...m, [key(s.id)]: e.target.value }))} /></TableCell>
                  <TableCell>{raw !== "" && !invalid ? <Badge tone={n >= 40 ? "success" : "danger"}>{grade(n)}</Badge> : <span className="text-text-tertiary">—</span>}</TableCell>
                  <TableCell><Input aria-label={`Remark for ${s.name}`} className="h-9" placeholder="Optional" value={remarks[`${exam}|${s.id}`] ?? ""} onChange={(e) => setRemarks((m) => ({ ...m, [`${exam}|${s.id}`]: e.target.value }))} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
