"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, LogOut, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Field } from "@/components/app/field";
import { Can } from "@/components/app/can";
import { StatCard } from "@/components/app/stat-card";
import { Timeline, type TimelineItem } from "@/components/app/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INVOICES, STUDENTS, attendanceStats, className, eventsFor, invoiceStatus, type EventKind, type Student } from "@/lib/mock";
import { formatDateOn, formatINR } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";
import { usePending } from "@/lib/use-pending";

const LABEL: Record<EventKind, string> = {
  admitted: "Admitted", promoted: "Promoted", detained: "Kept in same class", class_changed: "Class changed",
  left: "Left school", tc_issued: "Transfer certificate issued", rejoined: "Rejoined", passed_out: "Passed out",
};

export default function StudentProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const base = STUDENTS.find((s) => s.id === id);
  const [override, setOverride] = React.useState<Partial<Student>>({});
  const [extra, setExtra] = React.useState<TimelineItem[]>([]);
  const [open, setOpen] = React.useState(false);
  const today = useTodayIST();
  const { run, is } = usePending();
  if (!base) return <p className="text-muted-foreground">Student not found.</p>;
  const s: Student = { ...base, ...override };
  const stats = attendanceStats(s.id);
  const inv = INVOICES.find((i) => i.studentId === s.id);
  const left = s.status !== "active";

  const history: TimelineItem[] = [
    ...extra,
    ...eventsFor(s).reverse().map((e) => ({ id: e.id, title: LABEL[e.kind], detail: `${e.detail}${e.by ? ` · ${e.by}` : ""}`, when: formatDateOn(e.on), tone: e.kind === "left" || e.kind === "tc_issued" ? ("danger" as const) : e.kind === "admitted" ? ("brand" as const) : ("neutral" as const) })),
  ];

  function leave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const on = String(f.get("on")), reason = String(f.get("reason"));
    const tc = f.get("tc") === "on" ? `TC-2026-0${20 + Number(s.id.replace("st", ""))}` : undefined;
    run("left", () => {
    setOverride({ status: tc ? "tc_issued" : "left", leftOn: on, leavingReason: reason, tcNumber: tc });
    setExtra([{ id: "n1", title: tc ? "Left school, TC issued" : "Left school", detail: `${reason}${tc ? ` · ${tc}` : ""}`, when: formatDateOn(on), tone: "danger" }]);
    setOpen(false); toast.success(`${s.name} marked as left`);
    });
  }
  function rejoin() {
    setOverride({ status: "active", leftOn: undefined, leavingReason: undefined, tcNumber: undefined });
    setExtra([{ id: "n2", title: "Rejoined", detail: "Enrolled again", when: today ? formatDateOn(today) : "", tone: "brand" }]);
    toast.success(`${s.name} is active again`);
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link href="/students"><ArrowLeft /> Students</Link></Button>
      <PageHeader eyebrow={`${s.scholarNo} · Class ${className(s.classId)} · Roll ${s.rollNo}`} title={`${s.name}.`} dim={left ? "Left school." : "Active student."}
        actions={<Can access="academic.manage">
          {left ? <Button variant="secondary" onClick={rejoin}><RotateCcw /> Rejoin</Button> : <Button variant="secondary" onClick={() => setOpen(true)}><LogOut /> Mark as left</Button>}
        </Can>} />

      {left && (
        <Card className="flex flex-wrap items-center gap-3 bg-accent-subtle">
          <Badge tone="danger">Left school</Badge>
          <p className="text-sm">On {formatDateOn(s.leftOn!)}. {s.leavingReason}. {s.tcNumber && <>Transfer certificate {s.tcNumber}.</>} Attendance and new fees have stopped. The parent can still read past records.</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Attendance" value={`${stats.pct}%`} hint={`${stats.workingDays} working days`} />
        <StatCard label="Absent days" value={stats.absent} />
        <StatCard label="Half days" value={stats.half} hint="Count as 0.5" />
        <StatCard label="Fees" value={inv ? invoiceStatus(inv) : "—"} hint={inv ? `${formatINR(inv.paidPaise)} of ${formatINR(inv.totalPaise)}` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
            {[["Date of birth", formatDateOn(s.dob)], ["Gender", s.gender === "M" ? "Male" : "Female"], ["Guardian", s.guardian], ["Mobile", s.phone], ["Parent login", s.guardianEmail], ["Address", s.address]].map(([k, v]) => (
              <React.Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-words font-medium">{v}</dd></React.Fragment>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <Timeline items={history} />
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark {s.name} as left</DialogTitle>
            <DialogDescription>Attendance and new fee invoices stop. Past records, results and receipts stay. The parent keeps read-only access.</DialogDescription></DialogHeader>
          <form onSubmit={leave} className="flex flex-col gap-4">
            <Field label="Last day at school" htmlFor="on"><Input id="on" name="on" type="date" defaultValue={today} required /></Field>
            <Field label="Reason" htmlFor="reason"><Input id="reason" name="reason" placeholder="Family moved, changed school, ..." required /></Field>
            <div className="flex items-center gap-3"><Checkbox id="tc" name="tc" /><Label htmlFor="tc">Issue a transfer certificate</Label></div>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="destructive" loading={is("left")}>Mark as left</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
