"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, Download, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadFile } from "@/lib/api/download";
import { useSubjectWise, useTeacherWise, type TeacherWiseRow } from "@/lib/api/hooks/analytics";
import { useExams } from "@/lib/api/hooks/results";
import { errorText } from "@/lib/api/hooks/staff";
import { pct } from "@/lib/money";
import { monthStartOf } from "@/components/app/bits-a3";
import { cn } from "@/lib/utils";

type SortKey = "name" | "attendance" | "average" | "pass" | "change" | "rating" | "own";
const COLS: { key: SortKey; label: string; right?: boolean }[] = [
  { key: "attendance", label: "Attendance", right: true },
  { key: "average", label: "Average", right: true },
  { key: "pass", label: "Pass", right: true },
  { key: "change", label: "Change", right: true },
  { key: "rating", label: "Rating", right: true },
  { key: "own", label: "Own", right: true },
];
const value = (t: TeacherWiseRow, k: SortKey): string | number | null => {
  switch (k) {
    case "name": return t.name.toLowerCase();
    case "attendance": return t.class_attendance_percentage ?? t.taught_attendance_percentage;
    case "average": return t.average_percentage;
    case "pass": return t.pass_rate;
    case "change": return t.improvement;
    case "rating": return t.feedback?.average_rating ?? null;
    case "own": return t.staff_attendance.percentage;
  }
};
const change = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10} pts`);
const classesText = (t: TeacherWiseRow) => t.assignments.map((a) => (a.role === "class_teacher" ? `${a.class_label} (CT)` : `${a.class_label} ${a.subject ?? ""}`.trim())).join(", ") || "—";

/** Teacher-wise analytics (one endpoint). A teacher without academic or staff access gets only their own row ("Me"). */
export function TeachersPanel({ today }: { today: string }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [examId, setExamId] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [open, setOpen] = React.useState<TeacherWiseRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const exams = useExams();
  const f = from || (today ? monthStartOf(today) : ""), t = to || today;
  const q = useTeacherWise({ from_on: f, to_on: t, exam_id: examId || undefined });
  const d = q.data;

  const rows = React.useMemo(() => {
    const list = [...(d?.teachers ?? [])];
    list.sort((a, b) => {
      const x = value(a, sort.key), y = value(b, sort.key);
      if (x === y) return a.name.localeCompare(b.name);
      if (x === null) return 1;
      if (y === null) return -1;
      return (x < y ? -1 : 1) * sort.dir;
    });
    return list;
  }, [d, sort]);
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));

  async function exportXlsx() {
    setBusy(true);
    try { await downloadFile("/analytics/teachers/export", { from_on: f, to_on: t, exam_id: examId || undefined }, "teacher-wise.xlsx"); toast.success("Downloaded"); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  const me = d?.scope === "me";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input aria-label="From date" type="date" className="w-44" value={f} max={t || undefined} onChange={(e) => setFrom(e.target.value)} />
          <Input aria-label="To date" type="date" className="w-44" value={t} min={f || undefined} onChange={(e) => setTo(e.target.value)} />
          <NativeSelect aria-label="Exam" className="w-56" value={examId} onChange={(e) => setExamId(e.target.value)}><option value="">Latest</option>{exams.data?.items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect>
        </div>
        <Button variant="secondary" size="sm" onClick={exportXlsx} loading={busy} disabled={!d || d.teachers.length === 0}><Download /> Export</Button>
      </div>
      {q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : !d ? <LoadingBlock label="Loading" /> : d.teachers.length === 0 ? (
        <EmptyState icon={UsersRound} title={me ? "No classes" : "No teachers"} />
      ) : me ? (
        <Card className="p-6"><TeacherDetail t={d.teachers[0]} exam={d.exam} previous={d.previous_exam} /></Card>
      ) : (
        <Card>
          <CardHeader><div><CardTitle>Teachers</CardTitle></div></CardHeader>
          <Table className="min-w-[980px]">
            <TableHeader><TableRow>
              <TableHead><SortHead k="name" label="Teacher" sort={sort} onSort={toggle} /></TableHead>
              <TableHead>Classes</TableHead>
              {COLS.map((c) => <TableHead key={c.key} className="text-right"><SortHead k={c.key} label={c.label} sort={sort} onSort={toggle} right /></TableHead>)}
              <TableHead>Subjects</TableHead>
            </TableRow></TableHeader>
            <TableBody>{rows.map((x) => (
              <TableRow key={x.staff_id}>
                <TableCell><button type="button" onClick={() => setOpen(x)} className="flex items-center gap-3 text-left font-medium hover:text-brand"><Avatar name={x.name} />{x.name}</button></TableCell>
                <TableCell className="max-w-56 text-sm text-muted-foreground">{classesText(x)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(x.class_attendance_percentage ?? x.taught_attendance_percentage)}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{pct(x.average_percentage)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(x.pass_rate)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", x.improvement !== null && (x.improvement >= 0 ? "text-success" : "text-danger"))}>{change(x.improvement)}</TableCell>
                <TableCell className="text-right tabular-nums">{x.feedback?.average_rating != null ? `${x.feedback.average_rating} (${x.feedback.responses})` : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(x.staff_attendance.percentage)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{x.results.length ? x.results.map((r) => `${r.subject ?? "All"} ${r.class_label}: ${pct(r.average_percentage)} / ${pct(r.pass_rate)}`).join("; ") : "—"}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          
        </Card>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{open?.name}</DialogTitle><DialogDescription>{open?.designation || "Teacher"}</DialogDescription></DialogHeader>
          {open && d && <TeacherDetail t={open} exam={d.exam} previous={d.previous_exam} />}
        </DialogContent>
      </Dialog>
      {d && !q.isError && <SubjectsSection examId={examId || undefined} />}
    </div>
  );
}

function SortHead({ k, label, sort, onSort, right }: { k: SortKey; label: string; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; right?: boolean }) {
  const on = sort.key === k;
  return (
    <button type="button" onClick={() => onSort(k)} aria-label={`Sort by ${label}`} className={cn("inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-foreground", right && "flex-row-reverse", on && "text-foreground")}>
      {label}{on && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </button>
  );
}

function TeacherDetail({ t, exam, previous }: { t: TeacherWiseRow; exam: string | null; previous: string | null }) {
  const s = t.staff_attendance;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Attendance" value={pct(t.class_attendance_percentage ?? t.taught_attendance_percentage)} />
        <StatCard label="Average" value={pct(t.average_percentage)} />
        <StatCard label="Pass" value={pct(t.pass_rate)} hint={t.improvement !== null ? change(t.improvement) : undefined} />
        <StatCard label="Own" value={pct(s.percentage)} />
      </div>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Classes</h3>
        <Table className="min-w-[420px]">
          <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Attendance</TableHead></TableRow></TableHeader>
          <TableBody>{t.assignments.map((a) => (
            <TableRow key={`${a.class_id}${a.subject_id}`}><TableCell className="font-medium">Class {a.class_label}</TableCell><TableCell className="text-muted-foreground">{a.role === "class_teacher" ? "Class teacher" : a.subject}</TableCell><TableCell className="text-right tabular-nums">{pct(a.attendance_percentage)}</TableCell></TableRow>
          ))}</TableBody>
        </Table>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Results</h3>
        {t.results.length === 0 ? <p className="text-sm text-muted-foreground">No marks.</p> : (
          <Table className="min-w-[520px]">
            <TableHeader><TableRow><TableHead>Class</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Average</TableHead><TableHead className="text-right">Pass</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader>
            <TableBody>{t.results.map((r) => (
              <TableRow key={`${r.class_id}${r.subject_id}`}>
                <TableCell>Class {r.class_label} · {r.subject ?? "All"}{!r.published && <span className="ml-2 text-xs text-text-tertiary">draft</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{r.students}</TableCell><TableCell className="text-right tabular-nums">{pct(r.average_percentage)}</TableCell><TableCell className="text-right tabular-nums">{pct(r.pass_rate)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", r.improvement !== null && (r.improvement >= 0 ? "text-success" : "text-danger"))}>{change(r.improvement)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Feedback</h3>
        {t.feedback ? <p className="text-sm"><b className="tabular-nums">{t.feedback.average_rating ?? "—"}</b> / 5 · {t.feedback.responses} <span className="text-muted-foreground">({t.feedback.title})</span></p>
          : <p className="text-sm text-muted-foreground">—</p>}
      </section>
    </div>
  );
}

function SubjectsSection({ examId }: { examId?: string }) {
  const q = useSubjectWise(examId);
  const d = q.data;
  return (
    <Card>
      <CardHeader><div><CardTitle>Subjects</CardTitle></div></CardHeader>
      {q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : !d ? <LoadingBlock label="Loading" /> : d.subjects.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No marks.</p> : (
        <Table className="min-w-[640px]">
          <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Average</TableHead><TableHead className="text-right">Pass</TableHead><TableHead>Best</TableHead><TableHead>Weakest</TableHead></TableRow></TableHeader>
          <TableBody>{d.subjects.map((s) => (
            <TableRow key={s.subject_id}>
              <TableCell className="font-medium">{s.subject}</TableCell><TableCell className="text-right tabular-nums">{s.students}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{pct(s.average_percentage)}</TableCell><TableCell className="text-right tabular-nums">{pct(s.pass_rate)}</TableCell>
              <TableCell className="text-sm">{s.best_class ? `${s.best_class.class_label} (${pct(s.best_class.average_percentage)})` : "—"}</TableCell>
              <TableCell className="text-sm">{s.weakest_class ? `${s.weakest_class.class_label} (${pct(s.weakest_class.average_percentage)})` : "—"}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
    </Card>
  );
}
