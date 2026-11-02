"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import { Send, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { NoAccess } from "@/components/app/no-access";
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
import { isLive } from "@/lib/api/config";
import { ParentsLive } from "@/components/app/parents-live";

const STATUS: Record<InviteStatus, { label: string; tone: "neutral" | "warning" | "success" }> = {
  not_sent: { label: "Not sent", tone: "neutral" }, sent: { label: "Sent", tone: "warning" }, active: { label: "Active", tone: "success" },
};

function ParentsDemo() {
  const can = useCan();
  const [rows, setRows] = React.useState<ParentAccount[]>(PARENT_ACCOUNTS);
  const [dlg, setDlg] = React.useState<"list" | null>(null);
  const [text, setText] = React.useState("");
  const { run, is } = usePending(900);
  if (!can("academic.manage")) return <NoAccess need="the Academic permission" />;

  const pending = rows.filter((r) => r.status === "not_sent");
  const send = (emails: string[], key: string) => run(key, () => {
    const at = nowUTC();
    setRows((r) => r.map((x) => (emails.includes(x.email) ? { ...x, status: x.status === "active" ? "active" : "sent", lastSentAt: at, sendCount: x.sendCount + 1 } : x)));
    logAudit({ category: "staff", action: "login.sent", summary: emails.length === 1 ? `Sent login email to ${emails[0]}` : `Sent login emails to ${emails.length} parents`, entity: emails.length === 1 ? emails[0] : "Parents" });
    toast.success(emails.length === 1 ? "Login sent" : `${emails.length} logins sent`);
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
    logAudit({ category: "staff", action: "parents.added", summary: `Added ${logins} parent logins from an email list`, entity: "Parent logins", href: "/parents" });
    setRows([...by.values()]); setDlg(null); setText(""); toast.success(`${logins} logins ready`);
  }

  return (
    <>
      <PageHeader title="Parents"
        actions={<>
          <ExportButton fileName="parent-logins" build={() => [{ name: "Parent logins", headers: ["Parent", "Email", "Mobile", "Children", "Classes", "Status", "Last email (IST)", "Emails sent"],
            rows: rows.map((r) => [r.guardian, r.email, r.phone, r.children.map((c) => c.name).join(", "), r.children.map((c) => className(c.classId)).join(", "), STATUS[r.status].label, r.lastSentAt ? formatIST(r.lastSentAt) : "", r.sendCount]) }]} />
          <Button variant="secondary" onClick={() => setDlg("list")}><UserPlus /> Add list</Button>
          <Button variant="brand" disabled={!pending.length} loading={is("all")} onClick={() => send(pending.map((p) => p.email), "all")}><Send /> Send {pending.length}</Button>
        </>} />
      <Card>
        <Table className="min-w-[760px]">
          <TableHeader><TableRow><TableHead>Parent</TableHead><TableHead>Children</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead className="text-right"><span className="sr-only">Action</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.email}>
                <TableCell><p className="font-medium">{r.guardian}</p><p className="text-xs text-text-tertiary">{r.email}</p></TableCell>
                <TableCell>{r.children.map((c) => <span key={c.id} className="mr-1.5 inline-block"><Badge tone={r.children.length > 1 ? "brand" : "neutral"}>{c.name.split(" ")[0]} · {className(c.classId)}</Badge></span>)}</TableCell>
                <TableCell><Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge></TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{r.lastSentAt ? formatIST(r.lastSentAt) : "—"}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant={r.status === "not_sent" ? "brand" : "secondary"} loading={is(r.email)} onClick={() => send([r.email], r.email)}>{r.status === "not_sent" ? "Send" : "Resend"}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dlg === "list"} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add list</DialogTitle>
            <DialogDescription>Scholar no, email</DialogDescription></DialogHeader>
          <Field label="List" htmlFor="list"><Textarea id="list" value={text} onChange={(e) => setText(e.target.value)} placeholder={"RPS2001, rakesh@example.in\nRPS2008, rakesh@example.in"} className="font-mono text-[13px]" /></Field>
          {parsed.length > 0 && (
            <div className="flex flex-col gap-1 text-sm">
              <p className="text-muted-foreground">{valid.length}/{parsed.length} ready</p>
              {parsed.filter((p) => !p.ok).map((p, i) => <p key={i} className="text-danger">{p.no || "?"}: {p.student ? "bad email" : "not found"}</p>)}
            </div>
          )}
          <DialogFooter><Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button><Button variant="brand" disabled={!valid.length} onClick={addList}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ParentsPage() {
  const can = useCan();
  if (!isLive) return <ParentsDemo />;
  return can("academic.manage") ? <ParentsLive /> : <NoAccess need="the Academic permission" />;
}
