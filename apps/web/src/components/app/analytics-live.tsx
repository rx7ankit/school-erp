"use client";
import * as React from "react";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { BarChart } from "@/components/app/bar-chart";
import { HBarList, LineChart } from "@/components/app/charts";
import { ErrorBlock, LoadingBlock, classLabel } from "@/components/app/academic-live-ui";
import { monthStartOf } from "@/components/app/bits-a3";
import { useSession } from "@/components/session-provider";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClasses } from "@/lib/api/hooks/academic";
import { useAttendanceAnalytics, useFeesAnalytics, useResultsAnalytics, useStaffAttendanceAnalytics, useStudentsAnalytics } from "@/lib/api/hooks/analytics";
import { TeachersPanel } from "@/components/app/analytics-teachers";
import { useExams } from "@/lib/api/hooks/results";
import { inr, pct } from "@/lib/money";
import { hasAccess } from "@/lib/permissions";
import { formatDateOn } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** School analytics on the real API. Which tabs show follows what the API allows the signed-in person to see. */
export function AnalyticsLive() {
  const { user } = useSession();
  const showFees = hasAccess(user, "fees.manage");
  const showStaff = hasAccess(user, "staff.manage");
  const today = useTodayIST();
  return (
    <>
      <PageHeader title="Analytics." />
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger><TabsTrigger value="attendance">Attendance</TabsTrigger>
          {showFees && <TabsTrigger value="fees">Fees</TabsTrigger>}
          <TabsTrigger value="results">Results</TabsTrigger><TabsTrigger value="teachers">{hasAccess(user, "academic.manage") || showStaff ? "Teachers" : "Me"}</TabsTrigger>
          {showStaff && <TabsTrigger value="staff">Staff</TabsTrigger>}
        </TabsList>
        <TabsContent value="students"><StudentsPanel /></TabsContent>
        <TabsContent value="attendance"><AttendancePanel today={today} /></TabsContent>
        {showFees && <TabsContent value="fees"><FeesPanel /></TabsContent>}
        <TabsContent value="results"><ResultsPanel /></TabsContent>
        <TabsContent value="teachers"><TeachersPanel today={today} /></TabsContent>
        {showStaff && <TabsContent value="staff"><StaffPanel today={today} /></TabsContent>}
      </Tabs>
    </>
  );
}

function StudentsPanel() {
  const q = useStudentsAnalytics();
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingBlock label="Loading" />;
  const d = q.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active" value={d.active} />
        <StatCard label="Classes" value={d.by_class.length} />
        <StatCard label="Left this year" value={d.left_this_year} />
        <StatCard label="Passed out" value={d.passed_out} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><div><CardTitle>Strength</CardTitle></div></CardHeader>
          {d.by_class.length ? <HBarList rows={d.by_class.map((c) => ({ label: `Class ${c.class_label}`, value: c.students, hint: `of ${c.capacity}` }))} max={Math.max(1, ...d.by_class.map((c) => Math.max(c.students, c.capacity)))} format={(v) => String(v)} /> : <p className="text-sm text-muted-foreground">No classes.</p>}</Card>
        <div className="flex flex-col gap-4">
          <Card><CardHeader><div><CardTitle>Gender</CardTitle></div></CardHeader><Counts rows={d.by_gender} /></Card>
          <Card><CardHeader><div><CardTitle>Category</CardTitle></div></CardHeader><Counts rows={d.by_category} /></Card>
        </div>
      </div>
    </div>
  );
}
const Counts = ({ rows }: { rows: { key: string; count: number }[] }) => rows.length ? (
  <ul className="flex flex-col gap-2 text-sm">{rows.map((r) => <li key={r.key} className="flex justify-between border-b border-border pb-2 last:border-b-0 last:pb-0"><span className="capitalize">{r.key}</span><b className="tabular-nums">{r.count}</b></li>)}</ul>
) : <p className="text-sm text-muted-foreground">None.</p>;

function AttendancePanel({ today }: { today: string }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const classes = useClasses();
  const f = from || (today ? monthStartOf(today) : ""), t = to || today;
  const q = useAttendanceAnalytics(f, t, classId || undefined);
  const d = q.data;
  const trend = (d?.trend ?? []).filter((p) => p.percentage !== null).map((p) => ({ label: formatDateOn(p.day_on, "short"), value: r1(p.percentage!) }));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="From date" type="date" className="w-44" value={f} max={t || undefined} onChange={(e) => setFrom(e.target.value)} />
        <Input aria-label="To date" type="date" className="w-44" value={t} min={f || undefined} onChange={(e) => setTo(e.target.value)} />
        <NativeSelect aria-label="Class" className="w-44" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">All classes</option>{classes.data?.items.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}</NativeSelect>
      </div>
      {q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : !d ? <LoadingBlock label="Loading" /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Attendance" value={pct(d.overall_percentage)} />
            <StatCard label="Days" value={d.marked_days} />
            <StatCard label={`Below ${d.threshold}%`} value={d.students_below_threshold} />
          </div>
          {d.marked_days === 0 ? <EmptyState icon={BarChart3} title="No attendance" /> : (
            <>
              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                <Card><CardHeader><div><CardTitle>Trend</CardTitle></div></CardHeader>
                  {trend.length ? <LineChart label="Daily attendance percentage" data={trend} min={0} max={100} /> : <p className="text-sm text-muted-foreground">No data.</p>}</Card>
                <Card><CardHeader><div><CardTitle>By weekday</CardTitle></div></CardHeader>
                  <HBarList rows={d.by_weekday.filter((w) => w.percentage !== null).map((w) => ({ label: DAYS[w.weekday] ?? String(w.weekday), value: r1(w.percentage!) }))} warnBelow={90} /></Card>
              </div>
              {d.by_class.length > 1 && <Card><CardHeader><div><CardTitle>By class</CardTitle></div></CardHeader>
                <HBarList rows={d.by_class.filter((c) => c.percentage !== null).map((c) => ({ label: `Class ${c.class_label}`, value: r1(c.percentage!), hint: `${c.students}` }))} warnBelow={90} /></Card>}
            </>
          )}
        </>
      )}
    </div>
  );
}

function FeesPanel() {
  const q = useFeesAnalytics(true);
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingBlock label="Loading" />;
  const d = q.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Billed" value={inr(d.billed_paise)} />
        <StatCard label="Collected" value={inr(d.collected_paise)} />
        <StatCard label="This month" value={inr(d.collected_this_month_paise)} />
        <StatCard label="Dues" value={inr(d.dues_paise)} />
      </div>
      <Card><CardHeader><div><CardTitle>Top dues</CardTitle></div></CardHeader>
        {d.top_dues_classes.length === 0 ? <p className="text-sm text-muted-foreground">No dues.</p> : (
          <Table><TableHeader><TableRow><TableHead>Class</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Dues</TableHead></TableRow></TableHeader>
            <TableBody>{d.top_dues_classes.map((c) => <TableRow key={c.class_id ?? c.class_label}><TableCell className="font-medium">{c.class_id ? `Class ${c.class_label}` : c.class_label}</TableCell><TableCell className="text-right tabular-nums">{c.students}</TableCell><TableCell className="text-right tabular-nums">{inr(c.dues_paise)}</TableCell></TableRow>)}</TableBody></Table>
        )}</Card>
    </div>
  );
}

function ResultsPanel() {
  const exams = useExams();
  const [examId, setExamId] = React.useState("");
  const q = useResultsAnalytics(examId || undefined);
  const d = q.data;
  const best = d ? [...d.by_subject].filter((s) => s.average_percentage !== null).sort((a, b) => b.average_percentage! - a.average_percentage!) : [];
  return (
    <div className="flex flex-col gap-4">
      <NativeSelect aria-label="Exam" className="w-64" value={examId} onChange={(e) => setExamId(e.target.value)}><option value="">Latest</option>{exams.data?.items.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</NativeSelect>
      {q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : !d ? <LoadingBlock label="Loading" /> : !d.exam_id ? <EmptyState icon={BarChart3} title="No exam" /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Average" value={pct(d.average_percentage)} />
            <StatCard label="Pass rate" value={pct(d.pass_rate)} />
            <StatCard label="Best" value={best[0]?.subject ?? "—"} />
            <StatCard label="Weakest" value={best.at(-1)?.subject ?? "—"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><div><CardTitle>Subjects</CardTitle></div></CardHeader>
              {best.length ? <HBarList rows={best.map((s) => ({ label: s.subject, value: r1(s.average_percentage!), hint: s.pass_rate !== null ? `${r1(s.pass_rate)}%` : undefined }))} warnBelow={60} /> : <p className="text-sm text-muted-foreground">No marks.</p>}</Card>
            <Card><CardHeader><div><CardTitle>Grades</CardTitle></div></CardHeader>
              {d.grade_spread.length ? <BarChart label="Students in each grade" data={d.grade_spread.map((g) => ({ label: g.key, value: g.count }))} format={(v) => String(v)} height={200} /> : <p className="text-sm text-muted-foreground">No grades.</p>}</Card>
          </div>
          {d.by_class.length > 0 && <Card><CardHeader><div><CardTitle>Classes</CardTitle></div></CardHeader>
            <HBarList rows={d.by_class.filter((c) => c.average_percentage !== null).map((c) => ({ label: `Class ${c.class_label}`, value: r1(c.average_percentage!), hint: c.published ? "Published" : undefined }))} /></Card>}
        </>
      )}
    </div>
  );
}

function StaffPanel({ today }: { today: string }) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const f = from || (today ? monthStartOf(today) : ""), t = to || today;
  const q = useStaffAttendanceAnalytics(f, t, true);
  const d = q.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="From date" type="date" className="w-44" value={f} max={t || undefined} onChange={(e) => setFrom(e.target.value)} />
        <Input aria-label="To date" type="date" className="w-44" value={t} min={f || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>
      {q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : !d ? <LoadingBlock label="Loading" /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Present" value={d.present_today} />
            <StatCard label="Absent" value={d.absent_today} />
            <StatCard label="On leave" value={d.leave_today} />
            <StatCard label="Not marked" value={Math.max(0, d.active_staff - d.marked_today)} />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Present %" value={pct(d.present_percentage)} />
            <StatCard label="Present days" value={d.days_present} />
            <StatCard label="Absent days" value={d.days_absent} />
            <StatCard label="Leave days" value={d.days_leave} />
          </div>
        </>
      )}
    </div>
  );
}
