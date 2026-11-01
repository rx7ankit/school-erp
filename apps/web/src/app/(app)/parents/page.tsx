"use client";
import * as React from "react";
import { Mail, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { NoAccess } from "@/components/app/no-access";
import { StatCard } from "@/components/app/stat-card";
import { Field } from "@/components/app/field";
import { useCan } from "@/components/app/can";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PARENT_ACCOUNTS, STUDENTS, className, type InviteStatus, type ParentAccount } from "@/lib/mock";
import { formatIST, nowUTC } from "@/lib/time";
import { usePending } from "@/lib/use-pending";

const STATUS: Record<InviteStatus, { label: string; tone: "neutral" | "warning" | "success" }> = {
  not_sent: { label: "Not sent", tone: "neutral" }, sent: { label: "Email sent", tone: "warning" }, active: { label: "Logged in", tone: "success" },
};

export default function ParentsPage() {
  const can = useCan();
  const [rows, setRows] = React.useState<ParentAccount[]>(PARENT_ACCOUNTS);
  const [dlg, setDlg] = React.useState<"list" | "preview" | null>(null);
  const [text, setText] = React.useState("");
  const { run, is } = usePending(900);
  if (!can("academic.manage")) return <NoAccess need="the Academic permission" />;

  const pending = rows.filter((r) => r.status === "not_sent");
  const send = (emails: string[], key: string) => run(key, () => {
    const at = nowUTC();
    setRows((r) => r.map((x) => (emails.includes(x.email) ? { ...x, status: x.status === "active" ? "active" : "sent", lastSentAt: at, sendCount: x.sendCount + 1 } : x)));
    toast.success(emails.length === 1 ? `Login email sent to ${emails[0]}` : `Login emails sent to ${emails.length} parents`, { description: "A fresh temporary password was created for each." });
  });

  // Parse "scholar no, email" lines. Same email on two children = one login with both children.
  const parsed = text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [no, email] = l.split(/[,\t]/).map((x) => x.trim());
    const student = STUDENTS.find((s) => s.scholarNo.toLowerCase() === (no ?? "").toLowerCase());
    const ok = !!student && /^\S+@\S+\.\S+$/.test(email ?? "");
    return { no, email, student, ok };
  });
  const valid = parsed.filter((p) => p.ok);
  const logins = new Set(valid.map((p) => p.email.toLowerCase())).size;

  function addList() {
    const by = new Map<string, ParentAccount>();
    rows.forEach((r) => by.set(r.email.toLowerCase(), r));
    valid.forEach((p) => {
      const key = p.email.toLowerCase(), cur = by.get(key);
      if (cur) { if (!cur.children.some((c) => c.id === p.student!.id)) cur.children = [...cur.children, p.student!]; }
      else by.set(key, { email: key, guardian: p.student!.guardian, phone: p.student!.phone, children: [p.student!], status: "not_sent", sendCount: 0 });
    });
    setRows([...by.values()]); setDlg(null); setText(""); toast.success(`${logins} logins ready to send`);
  }

  return (
    <>
      <PageHeader eyebrow="Parent app" title="Parent logins." dim="Create, then send in one click."
        actions={<>
          <ExportButton fileName="parent-logins" build={() => [{ name: "Parent logins", headers: ["Parent", "Email", "Mobile", "Children", "Classes", "Status", "Last email (IST)", "Emails sent"],
            rows: rows.map((r) => [r.guardian, r.email, r.phone, r.children.map((c) => c.name).join(", "), r.children.map((c) => className(c.classId)).join(", "), STATUS[r.status].label, r.lastSentAt ? formatIST(r.lastSentAt) : "", r.sendCount]) }]} />
          <Button variant="secondary" onClick={() => setDlg("list")}><UserPlus /> Add email list</Button>
          <Button variant="brand" disabled={!pending.length} loading={is("all")} onClick={() => send(pending.map((p) => p.email), "all")}><Send /> Send to {pending.length} pending</Button>
        </>} />
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Logins" value={rows.length} />
        <StatCard label="Not sent" value={pending.length} />
        <StatCard label="Logged in" value={rows.filter((r) => r.status === "active").length} />
      </div>
      <Card>
        <div className="mb-4 flex justify-end"><Button variant="link" size="sm" onClick={() => setDlg("preview")}><Mail /> See what parents receive</Button></div>
        <Table className="min-w-[760px]">
          <TableHeader><TableRow><TableHead>Parent</TableHead><TableHead>Children</TableHead><TableHead>Status</TableHead><TableHead>Last sent</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.email}>
                <TableCell><p className="font-medium">{r.guardian}</p><p className="text-xs text-text-tertiary">{r.email}</p></TableCell>
                <TableCell>{r.children.map((c) => <span key={c.id} className="mr-1.5 inline-block"><Badge tone={r.children.length > 1 ? "brand" : "neutral"}>{c.name.split(" ")[0]} · {className(c.classId)}</Badge></span>)}</TableCell>
                <TableCell><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{r.lastSentAt ? formatIST(r.lastSentAt) : "—"}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant={r.status === "not_sent" ? "brand" : "secondary"} loading={is(r.email)} onClick={() => send([r.email], r.email)}>{r.status === "not_sent" ? "Send email" : "Resend"}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dlg === "list"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add parent emails</DialogTitle>
            <DialogDescription>One line per child: scholar number, then email. Use the same email for brothers and sisters and they share one login.</DialogDescription></DialogHeader>
          <Field label="Email list" htmlFor="list"><Textarea id="list" value={text} onChange={(e) => setText(e.target.value)} placeholder={"RPS2001, rakesh@example.in\nRPS2008, rakesh@example.in"} className="font-mono text-[13px]" /></Field>
          {parsed.length > 0 && (
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-muted-foreground">{valid.length} of {parsed.length} lines ready, {logins} {logins === 1 ? "login" : "logins"}.</p>
              {parsed.filter((p) => !p.ok).map((p, i) => <p key={i} className="text-danger">{p.no || "?"}: {p.student ? "email looks wrong" : "scholar number not found"}</p>)}
            </div>
          )}
          <DialogFooter><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button variant="brand" disabled={!valid.length} onClick={addList}>Create logins</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "preview"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Email preview</DialogTitle><DialogDescription>Each send creates a new temporary password. Parents must choose their own at first login.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-3 rounded-2xl bg-card p-5 text-sm">
            <p className="text-xs text-text-tertiary">Subject: Your Scool login for Rewa Public School</p>
            <p>Hello Rakesh Tiwari,</p>
            <p>You can now follow Aarav&apos;s school day in the Scool app.</p>
            <div className="rounded-xl bg-background p-3"><p>Email: <b>rakesh.tiwari@example.in</b></p><p>Temporary password: <b className="tabular-nums">K7m2-Pq9x</b></p></div>
            <p className="text-muted-foreground">Download Scool: App Store · Google Play</p>
          </div>
          <DialogFooter><Button variant="brand" onClick={() => setDlg(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
