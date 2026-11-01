"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/app/stat-card";
import { useSession } from "@/components/session-provider";
import { CLASSES, STUDENTS, attendanceStats, className } from "@/lib/mock";
import { classIdsFor, hasAccess } from "@/lib/permissions";
import { formatDateOn, formatIST, nowUTC } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";
import { usePending } from "@/lib/use-pending";
import { notify, type NotifType } from "@/lib/notifications";
import { ExportButton } from "@/components/app/export-button";
import { leaveFor, useLeaves } from "@/lib/leave";
import { cn } from "@/lib/utils";

/** One row per student. Each half-day is its own status, as in the data model. */
type Half = "present" | "absent" | "leave";
type Mark = { first: Half; second: Half };
type Kind = "present" | "absent" | "half" | "leave";
const PRESENT: Mark = { first: "present", second: "present" };

const kindOf = (m: Mark): Kind =>
  m.first === m.second ? (m.first === "present" ? "present" : m.first === "absent" ? "absent" : "leave") : "half";
const OPTIONS: { v: Kind; label: string }[] = [
  { v: "present", label: "Present" }, { v: "absent", label: "Absent" }, { v: "half", label: "Half day" }, { v: "leave", label: "Leave" },
];
const fromKind = (k: Kind): Mark =>
  k === "present" ? PRESENT : k === "absent" ? { first: "absent", second: "absent" } : k === "leave" ? { first: "leave", second: "leave" } : { first: "present", second: "absent" };

export default function AttendancePage() {
  const { user } = useSession();
  const mine = user ? classIdsFor(user, "class_teacher", CLASSES.map((c) => c.id)) : [];
  const [classId, setClassId] = React.useState(mine[0] ?? "");
  const [marks, setMarks] = React.useState<Record<string, Mark>>({});
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const today = useTodayIST();
  const { run, is } = usePending();
  const leaves = useLeaves();

  if (!hasAccess(user, "class_teacher")) return <NoAccess need="class teacher access" />;
  const students = STUDENTS.filter((s) => s.classId === classId && s.status === "active");
  // A student with approved leave today starts as Leave (or the matching half). The teacher can still change it.
  const approved = (id: string) => leaveFor(id, today, leaves);
  const preset = (id: string): Mark => {
    const l = approved(id);
    return !l ? PRESENT : l.half === "first" ? { first: "leave", second: "present" } : l.half === "second" ? { first: "present", second: "leave" } : fromKind("leave");
  };
  const get = (id: string): Mark => marks[id] ?? preset(id);
  const set = (id: string, m: Mark) => setMarks((x) => ({ ...x, [id]: m }));
  const counts = OPTIONS.map((o) => ({ ...o, n: students.filter((s) => kindOf(get(s.id)) === o.v).length }));
  const tone = { present: "success", absent: "danger", half: "warning", leave: "neutral" } as const;

  const stats = students.map((s) => ({ s, ...attendanceStats(s.id) }));
  const avg = stats.length ? Math.round((stats.reduce((a, x) => a + x.pct, 0) / stats.length) * 10) / 10 : 0;
  const low = stats.filter((x) => x.pct < 75).length;

  return (
    <>
      <PageHeader eyebrow="Class teacher" title="Attendance." dim={today ? formatDateOn(today, "weekday") : ""}
        actions={mine.length > 1 ? (
          <NativeSelect aria-label="Class" className="w-40" value={classId} onChange={(e) => { setClassId(e.target.value); setSavedAt(null); }}>
            {mine.map((id) => <option key={id} value={id}>Class {className(id)}</option>)}
          </NativeSelect>
        ) : <Badge tone="brand">Class {className(classId)}</Badge>} />

      <Tabs defaultValue="mark">
        <TabsList><TabsTrigger value="mark">Mark today</TabsTrigger><TabsTrigger value="stats">Stats</TabsTrigger></TabsList>

        <TabsContent value="mark" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {counts.map((c) => <Badge key={c.v} tone={tone[c.v]}>{c.n} {c.label}</Badge>)}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMarks({})}>Mark all present</Button>
          </div>
          <Card className="p-2 sm:p-3">
            <ul>
              {students.map((s) => {
                const m = get(s.id), k = kindOf(m);
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3 hover:bg-card-hover">
                    <span className="w-6 text-sm tabular-nums text-text-tertiary">{s.rollNo}</span>
                    <Avatar name={s.name} />
                    <span className="flex min-w-0 flex-1 basis-40 items-center gap-2"><span className="truncate font-medium">{s.name}</span>{approved(s.id) && <Badge>Approved leave</Badge>}</span>
                    {k === "half" && (
                      <div role="radiogroup" aria-label={`Which half is ${s.name} present`} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        Present in
                        {([["first", "1st half"], ["second", "2nd half"]] as const).map(([half, label]) => (
                          <button key={half} type="button" role="radio" aria-checked={m.first === "present" ? half === "first" : half === "second"}
                            onClick={() => set(s.id, half === "first" ? { first: "present", second: "absent" } : { first: "absent", second: "present" })}
                            className={cn("h-7 rounded-full bg-fill px-3 font-medium", (m.first === "present" ? half === "first" : half === "second") && "bg-solid text-on-solid")}>{label}</button>
                        ))}
                      </div>
                    )}
                    <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="inline-flex gap-0.5 rounded-full bg-fill p-[3px]">
                      {OPTIONS.map((o) => (
                        <button key={o.v} type="button" role="radio" aria-checked={k === o.v} onClick={() => set(s.id, fromKind(o.v))}
                          className={cn("h-8 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors", k === o.v && (o.v === "present" ? "bg-brand text-brand-foreground" : "bg-solid text-on-solid"))}>{o.label}</button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <div className="flex flex-wrap items-center justify-end gap-4">
            {savedAt && <span className="flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> Saved at {formatIST(savedAt, "time")} IST</span>}
            <Button variant="brand" size="lg" loading={is("save")} onClick={() => run("save", () => {
              setSavedAt(nowUTC());
              // Parents hear about it straight away: present, absent, or which half their child attended.
              notify(students.map((s) => { const m = get(s.id), k = kindOf(m);
                const type: NotifType = k === "present" ? "attendance_present" : k === "half" ? (m.first === "present" ? "attendance_first_half" : "attendance_second_half") : "attendance_absent";
                return { type, studentId: s.id, params: {} }; }));
              logAudit({ category: "attendance", action: "attendance.saved", summary: `Saved attendance for Class ${className(classId)} (${students.length} students, ${counts.find((c) => c.v === "absent")?.n ?? 0} absent, ${counts.find((c) => c.v === "half")?.n ?? 0} half day)`, entity: `Class ${className(classId)}`, href: "/attendance" });
              toast.success(`Attendance saved for Class ${className(classId)}`, { description: `${students.length} parents notified` });
            })}>Save attendance</Button>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard label="Class average" value={`${avg}%`} hint="Half days count as 0.5" />
            <StatCard label="Below 75%" value={low} hint={low ? "Needs a call to parents" : "Nobody at risk"} />
            <StatCard label="Working days" value={stats[0]?.workingDays ?? 0} hint="This month" />
          </div>
          <div className="flex justify-end"><ExportButton fileName={`attendance-${className(classId)}`} build={() => [{ name: `Class ${className(classId)}`, headers: ["Roll", "Student", "Working days", "Absent days", "Half days", "Attendance %"],
            rows: stats.map((x) => [x.s.rollNo, x.s.name, x.workingDays, x.absent, x.half, x.pct]) }]} /></div>
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Student</TableHead><TableHead className="text-right">Absent</TableHead><TableHead className="text-right">Half days</TableHead><TableHead className="w-56">Attendance</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...stats].sort((a, b) => a.pct - b.pct).map(({ s, absent, half, pct }) => (
                  <TableRow key={s.id}>
                    <TableCell><div className="flex items-center gap-3"><Avatar name={s.name} /><span className="font-medium">{s.name}</span></div></TableCell>
                    <TableCell className="text-right tabular-nums">{absent}</TableCell>
                    <TableCell className="text-right tabular-nums">{half}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-fill"><div className={cn("h-full rounded-full", pct < 75 ? "bg-danger" : "bg-brand")} style={{ width: `${pct}%` }} /></div>
                        <span className="w-12 text-right text-sm tabular-nums">{pct}%</span>
                      </div>
                    </TableCell>
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
