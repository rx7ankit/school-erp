"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SCHOOLS, billable, invoicesFor, type SchoolStatus } from "@/lib/platform-mock";
import { formatINR, formatIST, nowUTC } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { useTodayIST } from "@/lib/use-today";

const TONE = { active: "success", trial: "warning", suspended: "danger" } as const;
const monthLabel = (ym: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));

export default function OwnerSchool({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const base = SCHOOLS.find((s) => s.id === id);
  const [status, setStatus] = React.useState<SchoolStatus | null>(null);
  const [sentAt, setSentAt] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const { run, is } = usePending();
  const today = useTodayIST();
  if (!base) return <p className="text-muted-foreground">School not found.</p>;
  const s = { ...base, status: status ?? base.status };
  const invoices = today ? invoicesFor(s, today) : [];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit"><Link href="/owner/schools"><ArrowLeft /> Schools</Link></Button>
      <PageHeader eyebrow={s.city} title={`${s.name}.`} dim={s.status === "suspended" ? "Suspended." : s.status === "trial" ? "On trial." : "Active."}
        actions={<>
          <Button variant="secondary" loading={is("invite")} onClick={() => run("invite", () => { setSentAt(nowUTC()); toast.success(`Login email sent to ${s.adminEmail}`, { description: "A fresh temporary password was created." }); })}><Mail /> Resend admin login</Button>
          {s.status === "suspended"
            ? <Button variant="brand" loading={is("status")} onClick={() => run("status", () => { setStatus("active"); toast.success("School reactivated"); })}><Play /> Reactivate</Button>
            : <Button variant="secondary" onClick={() => setConfirm(true)}><Pause /> Suspend</Button>}
        </>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={s.students.toLocaleString("en-IN")} hint="Active today" />
        <StatCard label="Price" value={`${formatINR(s.pricePaise)}`} hint="per student per month" />
        <StatCard label="Monthly" value={billable(s) ? formatINR(billable(s)) : "—"} hint={s.status === "trial" ? "Free during trial" : undefined} />
        <StatCard label="Status" value={<Badge tone={TONE[s.status]} className="capitalize">{s.status}</Badge>} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>School admin</CardTitle></CardHeader>
          <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
            <dt className="text-muted-foreground">Name</dt><dd className="font-medium">{s.adminName}</dd>
            <dt className="text-muted-foreground">Email</dt><dd className="break-words font-medium">{s.adminEmail}</dd>
            <dt className="text-muted-foreground">Login</dt><dd>{s.adminLoggedIn ? <Badge tone="success">Logged in</Badge> : <Badge tone="warning">Not yet</Badge>}</dd>
            <dt className="text-muted-foreground">Last email</dt><dd className="tabular-nums">{(sentAt ?? s.inviteSentAt) ? `${formatIST((sentAt ?? s.inviteSentAt)!)} IST` : "—"}</dd>
            <dt className="text-muted-foreground">Joined</dt><dd className="tabular-nums">{formatIST(s.createdAt)} IST</dd>
          </dl>
          <p className="mt-5 text-xs text-text-tertiary">You see counts and billing only. Student, fee and message records stay private to the school.</p>
        </Card>
        <Card>
          <CardHeader><CardTitle>Billing</CardTitle></CardHeader>
          {invoices.length === 0 ? <p className="text-sm text-muted-foreground">No invoices yet. Billing starts when the trial ends.</p> : (
            <Table className="min-w-0">
              <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{invoices.map((i) => <TableRow key={i.id}><TableCell>{monthLabel(i.ym)}</TableCell><TableCell className="text-right tabular-nums">{i.students}</TableCell><TableCell className="text-right tabular-nums">{formatINR(i.amountPaise)}</TableCell><TableCell><Badge tone={i.status === "paid" ? "success" : "warning"} className="capitalize">{i.status}</Badge></TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </Card>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Suspend {s.name}?</DialogTitle><DialogDescription>Every staff and parent login of this school is blocked right away. Nothing is deleted. You can reactivate any time.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="destructive" loading={is("status")} onClick={() => run("status", () => { setStatus("suspended"); setConfirm(false); toast.success("School suspended"); })}>Suspend school</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
