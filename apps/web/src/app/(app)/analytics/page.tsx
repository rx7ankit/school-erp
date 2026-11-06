"use client";
import * as React from "react";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { StatCard } from "@/components/app/stat-card";
import { BarChart } from "@/components/app/bar-chart";
import { Heatmap, HBarList, LineChart, Stars } from "@/components/app/charts";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/components/session-provider";
import { allClassIds, attendanceByClass, attendanceByWeekday, attendanceSummary, attendanceTrend, heatmap, resultsSummary, teacherRows } from "@/lib/analytics-mock";
import { className } from "@/lib/mock";
import { useTodayIST } from "@/lib/use-today";
import { isLive } from "@/lib/api/config";
import { AnalyticsLive } from "@/components/app/analytics-live";

export default function AnalyticsPage() {
  return isLive ? <AnalyticsLive /> : <AnalyticsDemo />;
}

function AnalyticsDemo() {
  const { user } = useSession();
  const today = useTodayIST();
  const [scopePick, setScopePick] = React.useState("all");
  const [heatClass, setHeatClass] = React.useState("");
  if (!user || !today) return null;

  // Admin and managers see the whole school. A teacher sees the classes they are assigned to.
  const wide = user.isAdmin || user.permissions.some((p) => p === "academic.manage" || p === "people.manage");
  const mine = wide ? allClassIds() : user.classes.map((c) => c.classId);
  const ids = scopePick === "all" ? mine : [scopePick];
  const att = attendanceSummary(ids, today);
  const res = resultsSummary(ids);
  const heatId = mine.includes(heatClass) ? heatClass : mine[0];
  const heat = heatmap(heatId, today);
  const teachers = teacherRows().filter((t) => wide || t.staff.id === user.id);

  return (
    <>
      <PageHeader title="Analytics."
        actions={<>
          <ExportButton fileName="analytics" build={() => [
            { name: "Attendance by student", headers: ["Student", "Class", "Attendance % (20 school days)"], rows: att.students.map((r) => [r.s.name, className(r.s.classId), r.pct]) },
            { name: "Attendance by class", headers: ["Class", "Attendance %"], rows: attendanceByClass(ids, today).map((r) => [r.label, r.value]) },
            { name: "Subject averages", headers: ["Subject", "Average marks (of 100)"], rows: res.subjects.map((r) => [r.label, r.value]) },
            { name: "Teachers", headers: ["Teacher", "Subject", "Classes", "Subject average", "Attendance %", "Leave days", "Parent rating"], rows: teachers.map((t) => [t.staff.name, t.subject, t.classes, t.resultAvg, t.attendancePct, t.leaveDays, t.rating]) }]} />
          {mine.length > 1 && (
          <NativeSelect aria-label="Class filter" className="w-44" value={scopePick} onChange={(e) => setScopePick(e.target.value)}>
            <option value="all">{wide ? "All classes" : "My classes"}</option>
            {mine.map((id) => <option key={id} value={id}>Class {className(id)}</option>)}
          </NativeSelect>
        )}</>} />

      <Tabs defaultValue="attendance">
        <TabsList><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="results">Results</TabsTrigger><TabsTrigger value="teachers">{wide ? "Teachers" : "Me"}</TabsTrigger></TabsList>

        <TabsContent value="attendance" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Attendance" value={`${att.avg}%`} />
            <StatCard label="Absent today" value={att.absentToday} />
            <StatCard label="Half days" value={att.halfDays} />
            <StatCard label="Below 75%" value={att.atRisk.length} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader><div><CardTitle>Trend</CardTitle></div></CardHeader>
              <LineChart label="Daily attendance percentage for the last twenty school days" data={attendanceTrend(ids, today)} min={60} max={100} />
            </Card>
            <Card>
              <CardHeader><div><CardTitle>By weekday</CardTitle></div></CardHeader>
              <HBarList rows={attendanceByWeekday(ids, today).map((d) => ({ label: d.label, value: d.value }))} warnBelow={90} />
            </Card>
          </div>
          {ids.length > 1 && (
            <Card>
              <CardHeader><div><CardTitle>By class</CardTitle></div></CardHeader>
              <HBarList rows={attendanceByClass(ids, today)} warnBelow={90} />
            </Card>
          )}
          <Card>
            <CardHeader>
              <div><CardTitle>Last 14 days</CardTitle></div>
              {mine.length > 1 && <NativeSelect aria-label="Heatmap class" className="w-36" value={heatId} onChange={(e) => setHeatClass(e.target.value)}>{mine.map((id) => <option key={id} value={id}>Class {className(id)}</option>)}</NativeSelect>}
            </CardHeader>
            <Heatmap days={heat.days} rows={heat.rows} />
          </Card>
          {att.atRisk.length > 0 && (
            <Card>
              <CardHeader><div><CardTitle>Needs attention</CardTitle></div></CardHeader>
              <ul>{att.atRisk.slice(0, 8).map((r) => (
                <li key={r.s.id} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
                  <Avatar name={r.s.name} /><div className="min-w-0 flex-1"><p className="font-medium">{r.s.name}</p><p className="text-xs text-text-tertiary">Class {className(r.s.classId)} · {r.s.guardian}, {r.s.phone}</p></div>
                  <Badge tone="danger">{r.pct}%</Badge>
                </li>))}
              </ul>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Average" value={`${res.avg}%`} />
            <StatCard label="Pass rate" value={`${res.passRate}%`} />
            <StatCard label="Best" value={[...res.subjects].sort((a, b) => b.value - a.value)[0].label} />
            <StatCard label="Weakest" value={[...res.subjects].sort((a, b) => a.value - b.value)[0].label} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><div><CardTitle>Subjects</CardTitle></div></CardHeader>
              <HBarList rows={res.subjects} format={(v) => `${v}`} warnBelow={60} /></Card>
            <Card><CardHeader><div><CardTitle>Grades</CardTitle></div></CardHeader>
              <BarChart label="Students in each grade band" data={res.spread} format={(v) => `${v}`} height={200} /></Card>
          </div>
          {ids.length > 1 && <Card><CardHeader><div><CardTitle>Classes</CardTitle></div></CardHeader><HBarList rows={res.classes} /></Card>}
          <div className="grid gap-4 lg:grid-cols-2">
            {([["Top performers", res.top], ["Needs support", res.support]] as const).map(([title, list]) => (
              <Card key={title}><CardHeader><CardTitle>{title}</CardTitle></CardHeader>
                <ul>{list.map((x) => <li key={x.name} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0"><Avatar name={x.name} /><span className="flex-1 font-medium">{x.name}<span className="ml-2 text-xs font-normal text-text-tertiary">{x.cls}</span></span><span className="tabular-nums">{x.pct}%</span></li>)}</ul>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teachers">
          <Card>
            <CardHeader><div><CardTitle>{wide ? "Teachers" : "Me"}</CardTitle></div></CardHeader>
            <Table className="min-w-[760px]">
              <TableHeader><TableRow><TableHead>Teacher</TableHead><TableHead>Classes</TableHead><TableHead className="w-48">Average</TableHead><TableHead className="text-right">Attendance</TableHead><TableHead className="text-right">Leave</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
              <TableBody>
                {teachers.map((t) => (
                  <TableRow key={t.staff.id}>
                    <TableCell><div className="flex items-center gap-3"><Avatar name={t.staff.name} /><div><p className="font-medium">{t.staff.name}</p><p className="text-xs text-text-tertiary">{t.subject}</p></div></div></TableCell>
                    <TableCell>{t.classes}</TableCell>
                    <TableCell>{t.resultAvg === null ? "—" : <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full bg-solid" style={{ width: `${t.resultAvg}%` }} /></div><span className="w-10 text-right text-sm tabular-nums">{t.resultAvg}</span></div>}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.attendancePct}%</TableCell>
                    <TableCell className="text-right tabular-nums">{t.leaveDays} d</TableCell>
                    <TableCell>{t.rating === null ? <span className="text-text-tertiary">Not shared</span> : <span className="flex items-center gap-2"><Stars value={t.rating} /><span className="tabular-nums text-sm">{t.rating}</span></span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
