"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadFile } from "@/lib/api/download";
import { useClassStats, useStudentCalendar, type StudentStats } from "@/lib/api/hooks/attendance";
import { errorText } from "@/lib/api/hooks/staff";
import { formatDateOn } from "@/lib/time";
import { cn } from "@/lib/utils";

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}%`);
const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/** Month picker. An empty month means the academic year so far. */
export function PeriodPicker({ month, setMonth, today }: { month: string; setMonth: (m: string) => void; today: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="Month" type="month" className="w-44" value={month} max={today.slice(0, 7)} onChange={(e) => setMonth(e.target.value)} />
      <Button variant={month ? "secondary" : "brand"} size="sm" onClick={() => setMonth("")}>Year so far</Button>
      {month !== today.slice(0, 7) && <Button variant="ghost" size="sm" onClick={() => setMonth(today.slice(0, 7))}>This month</Button>}
    </div>
  );
}

export function ClassStatsTab({ classId, today }: { classId: string; today: string }) {
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [threshold, setThreshold] = React.useState(75);
  const [open, setOpen] = React.useState<StudentStats | null>(null);
  const [busy, setBusy] = React.useState(false);
  const q = useClassStats(classId, { month: month || undefined }, threshold);
  const d = q.data;

  async function exportXlsx() {
    setBusy(true);
    try { await downloadFile(`/attendance/classes/${classId}/stats/export`, { month: month || undefined, threshold }, "attendance.xlsx"); toast.success("Excel file downloaded"); }
    catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodPicker month={month} setMonth={setMonth} today={today} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">Flag below
            <Input aria-label="Threshold percent" type="number" min={0} max={100} className="w-20" value={threshold} onChange={(e) => setThreshold(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />%
          </label>
        </div>
        <Button variant="secondary" loading={busy} disabled={!d} onClick={exportXlsx}>{!busy && <Download />}Export Excel</Button>
      </div>
      {q.isPending ? <LoadingBlock label="Loading statistics" /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : d && (
        <div className={cn("flex flex-col gap-4", q.isPlaceholderData && "opacity-60")}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Class average" value={pct(d.summary.percentage)} hint="Half days count as 0.5" />
            <StatCard label={`Below ${threshold}%`} value={d.students.filter((s) => s.below_threshold).length} hint={d.students.some((s) => s.below_threshold) ? "Needs a call to parents" : "Nobody at risk"} />
            <StatCard label="Working days" value={d.summary.working_days} hint={`${formatDateOn(d.from_on, "short")} – ${formatDateOn(d.to_on)}`} />
            <StatCard label="Late arrivals" value={d.summary.late_days} hint="Student-days" />
          </div>
          {d.students.length === 0 ? <EmptyState icon={Download} title="No students to show" /> : (
            <Card>
              <Table className="min-w-[760px]">
                <TableHeader><TableRow><TableHead>Student</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="text-right">Absent</TableHead><TableHead className="text-right">Leave</TableHead><TableHead className="text-right">Half days</TableHead><TableHead className="text-right">Late</TableHead><TableHead className="w-56">Attendance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...d.students].sort((a, b) => (a.percentage ?? 101) - (b.percentage ?? 101)).map((s) => (
                    <TableRow key={s.student_id}>
                      <TableCell>
                        <button type="button" className="flex items-center gap-3 text-left" onClick={() => setOpen(s)} aria-label={`Open calendar of ${s.name}`}>
                          <Avatar name={s.name} /><span><span className="block font-medium">{s.name}</span><span className="block text-xs text-text-tertiary">Roll {s.roll_no ?? "—"} · {s.scholar_no}{s.status !== "active" ? ` · ${s.status}` : ""}</span></span>
                        </button>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.working_days}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(s.absent_days)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(s.leave_days)}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.half_days}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.late_days}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill"><div className={cn("h-full rounded-full", s.below_threshold ? "bg-danger" : "bg-brand")} style={{ width: `${s.percentage ?? 0}%` }} /></div>
                          <span className="w-14 text-right text-sm tabular-nums">{pct(s.percentage)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}
      <StudentCalendar student={open} month={month || today.slice(0, 7)} today={today} onClose={() => setOpen(null)} />
    </div>
  );
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_STYLE: Record<string, string> = {
  full: "bg-success/15 text-success", half: "bg-warning/15 text-warning", absent: "bg-danger/15 text-danger", leave: "bg-fill text-foreground", not_marked: "text-text-tertiary",
};
const shiftMonth = (m: string, by: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + by, 1)); return d.toISOString().slice(0, 7); };

/** One student's month: a calendar of full, half, absent and leave days, plus the totals. */
function StudentCalendar({ student, month: start, today, onClose }: { student: StudentStats | null; month: string; today: string; onClose: () => void }) {
  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">{student && <CalendarBody key={student.student_id} student={student} start={start} today={today} />}</DialogContent>
    </Dialog>
  );
}

function CalendarBody({ student, start, today }: { student: StudentStats; start: string; today: string }) {
  const [month, setMonth] = React.useState(start);
  const q = useStudentCalendar(student.student_id, month);
  const lead = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const byDay = new Map((q.data?.days ?? []).map((x) => [x.day_on, x]));
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const st = q.data?.stats;
  return (
    <>
      <DialogHeader><DialogTitle>{student.name}</DialogTitle><DialogDescription>Scholar no. {student.scholar_no}</DialogDescription></DialogHeader>
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></Button>
        <span className="font-bold">{formatDateOn(`${month}-01`, "date").replace(/^1 /, "")}</span>
        <Button variant="secondary" size="icon-sm" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></Button>
      </div>
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs" role="grid" aria-label="Attendance calendar">
            {DOW.map((d) => <span key={d} className="py-1 font-medium uppercase tracking-[0.06em] text-text-tertiary">{d}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: count }, (_, i) => {
              const key = `${month}-${String(i + 1).padStart(2, "0")}`;
              const x = byDay.get(key);
              const label = x?.holiday ? `Holiday: ${x.holiday}` : x ? x.status.replace("_", " ") : "";
              return (
                <span key={key} title={`${formatDateOn(key)}${label ? `: ${label}` : ""}`} role="gridcell"
                  className={cn("grid h-10 place-items-center rounded-xl text-sm tabular-nums", x?.holiday ? "bg-brand/10 text-brand" : STATUS_STYLE[x?.status ?? "not_marked"])}>{i + 1}</span>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone="success">Full day</Badge><Badge tone="warning">Half day</Badge><Badge tone="danger">Absent</Badge><Badge>Leave</Badge><Badge tone="brand">Holiday</Badge>
          </div>
          {st && (
            <dl className="grid grid-cols-3 gap-3 text-sm">
              {([["Attendance", pct(st.percentage)], ["Working days", st.working_days], ["Present", num(st.present_days)], ["Absent", num(st.absent_days)], ["Leave", num(st.leave_days)], ["Late", st.late_days]] as const).map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-card px-3 py-2"><dt className="text-xs text-text-tertiary">{k}</dt><dd className="font-bold tabular-nums">{v}</dd></div>
              ))}
            </dl>
          )}
          {q.data && q.data.holidays.length > 0 && <p className="text-xs text-muted-foreground">Holidays: {q.data.holidays.map((h) => `${h.title} (${formatDateOn(h.from_on, "short")})`).join(", ")}</p>}
        </>
      )}
    </>
  );
}
