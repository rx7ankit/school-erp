"use client";
import * as React from "react";
import { StatCard } from "@/components/app/stat-card";
import { Timeline, type TimelineItem } from "@/components/app/timeline";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { INVOICES, attendanceStats, eventsFor, invoiceStatus, type EventKind, type Student } from "@/lib/mock";
import type { StudentRecord } from "@/lib/student-record";
import { formatDateOn } from "@/lib/time";

const LABEL: Record<EventKind, string> = {
  admitted: "Admitted", promoted: "Promoted", detained: "Kept in same class", class_changed: "Class changed",
  left: "Left school", tc_issued: "Transfer certificate issued", rejoined: "Rejoined", passed_out: "Passed out",
};

/** Stats, basic details and history. `original` is the student before any change in this session. */
export function OverviewTab({ student, original, record }: { student: Student; original: Student; record: StudentRecord }) {
  const stats = attendanceStats(student.id);
  const inv = INVOICES.find((i) => i.studentId === student.id);
  const history: TimelineItem[] = [
    ...record.history.map((h) => ({ id: h.id, title: h.title, detail: h.detail, when: formatDateOn(h.on), tone: h.tone })),
    ...eventsFor(original).reverse().map((e) => ({ id: e.id, title: LABEL[e.kind], detail: `${e.detail}${e.by ? ` · ${e.by}` : ""}`, when: formatDateOn(e.on), tone: e.kind === "left" || e.kind === "tc_issued" ? ("danger" as const) : e.kind === "admitted" ? ("brand" as const) : ("neutral" as const) })),
  ];
  const rows: [string, string][] = [
    ["Born", formatDateOn(student.dob)], ["Gender", student.gender === "M" ? "Male" : "Female"], ["Guardian", student.guardian],
    ["Mobile", student.phone], ["Email", student.guardianEmail], ["Address", student.address],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Attendance" value={`${stats.pct}%`} />
        <StatCard label="Absent" value={stats.absent} />
        <StatCard label="Half days" value={stats.half} />
        <StatCard label="Fees" value={inv ? invoiceStatus(inv) : "—"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            {rows.map(([k, v]) => (<React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-words font-medium">{v}</dd></React.Fragment>))}
          </dl>
        </Card>
        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <Timeline items={history} />
        </Card>
      </div>
    </div>
  );
}
