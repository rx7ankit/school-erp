"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { StatCard } from "@/components/app/stat-card";
import { Field } from "@/components/app/field";
import { useCan } from "@/components/app/can";
import { Pager, usePaged } from "@/components/app/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INVOICES, STUDENTS, className, invoiceStatus, type FeeMode, type Invoice } from "@/lib/mock";
import { formatDateOn, formatINR, formatIST, nowUTC } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { ExportButton } from "@/components/app/export-button";
import { ReceiptDialog } from "@/components/app/receipt-dialog";
import { receiptFor, type Receipt } from "@/lib/receipt";
import { notify } from "@/lib/notifications";
import { rupees } from "@/lib/export";
import { Bell, Receipt as ReceiptIcon } from "lucide-react";

const TONE = { paid: "success", partial: "warning", unpaid: "danger" } as const;

export default function FeesPage() {
  const can = useCan();
  return can("fees.manage") ? <FeesContent /> : <NoAccess need="the Fees permission" />;
}

function FeesContent() {
  const [rows, setRows] = React.useState<Invoice[]>(INVOICES);
  const [filter, setFilter] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [pay, setPay] = React.useState<Invoice | null>(null);
  const { run, is } = usePending();
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const [remindOpen, setRemindOpen] = React.useState(false);

  const billed = rows.reduce((s, i) => s + i.totalPaise, 0);
  const collected = rows.reduce((s, i) => s + i.paidPaise, 0);
  const student = (id: string) => STUDENTS.find((s) => s.id === id)!;
  const owing = rows.filter((i) => i.paidPaise < i.totalPaise && student(i.studentId).status === "active");
  const remind = (list: Invoice[]) => notify(list.map((i) => ({ type: "fee_reminder" as const, studentId: i.studentId, params: { amountPaise: i.totalPaise - i.paidPaise, dueOn: i.dueOn } })));
  const shown = rows.filter((i) => (filter === "all" || invoiceStatus(i) === filter) && student(i.studentId).name.toLowerCase().includes(q.toLowerCase()));

  const paged = usePaged(shown, 12);

  function record(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pay) return;
    const f = new FormData(e.currentTarget);
    const paise = Math.round(Number(f.get("amount")) * 100);
    const due = pay.totalPaise - pay.paidPaise;
    if (!(paise > 0) || paise > due) { toast.error(`Enter an amount up to ${formatINR(due)}`); return; }
    run("pay", () => {
    const at = nowUTC();
    const mode = f.get("mode") as FeeMode, reference = String(f.get("ref") || "") || undefined;
    const updated = { ...pay, paidPaise: pay.paidPaise + paise, lastPaymentAt: at, mode };
    setRows((r) => r.map((x) => (x.id === pay.id ? updated : x)));
    setReceipt({ ...receiptFor(updated, paise, at), reference });
    toast.success(`Recorded ${formatINR(paise)}`, { description: `${formatIST(at)} IST` });
    setPay(null);
    });
  }

  return (
    <>
      <PageHeader eyebrow="Term 2 · 2026–27" title="Fees." dim="Record what you collect."
        actions={<>
          <ExportButton fileName="fees-term-2" build={() => [{ name: "Fees", headers: ["Invoice", "Student", "Class", "Scholar no.", "Total (₹)", "Paid (₹)", "Balance (₹)", "Status", "Last payment (IST)", "Paid by"],
            rows: rows.map((i) => { const st = student(i.studentId); return [i.no, st.name, className(st.classId), st.scholarNo, rupees(i.totalPaise), rupees(i.paidPaise), rupees(i.totalPaise - i.paidPaise), invoiceStatus(i), i.lastPaymentAt ? formatIST(i.lastPaymentAt) : "", i.mode ?? ""]; }) }]} />
          <Button variant="brand" disabled={!owing.length} onClick={() => setRemindOpen(true)}><Bell /> Send reminders ({owing.length})</Button>
        </>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Billed" value={formatINR(billed)} />
        <StatCard label="Collected" value={formatINR(collected)} hint={`${Math.round((collected / billed) * 100)}% of billed`} />
        <StatCard label="Pending" value={formatINR(billed - collected)} hint={`Due ${formatDateOn("2026-11-10")}`} />
      </div>
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>{["all", "unpaid", "partial", "paid"].map((f) => <TabsTrigger key={f} value={f} className="capitalize">{f}</TabsTrigger>)}</TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
            <Input aria-label="Search invoices" className="rounded-full pl-10" placeholder="Search student" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Student</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {paged.rows.map((i) => {
              const st = invoiceStatus(i), s = student(i.studentId);
              return (
                <TableRow key={i.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{i.no}</TableCell>
                  <TableCell><p className="font-medium">{s.name}</p><p className="text-xs text-text-tertiary">Class {className(s.classId)}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(i.totalPaise)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(i.paidPaise)}{i.lastPaymentAt && <p className="text-xs text-text-tertiary">{formatIST(i.lastPaymentAt, "short")}</p>}</TableCell>
                  <TableCell><Badge tone={TONE[st]} className="capitalize">{st}</Badge></TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1.5">
                    {i.paidPaise > 0 && <Button size="icon-sm" variant="ghost" aria-label="Receipt" onClick={() => setReceipt(receiptFor(i))}><ReceiptIcon /></Button>}
                    {st !== "paid" && <Button size="icon-sm" variant="ghost" aria-label="Send reminder" onClick={() => { remind([i]); toast.success(`Reminder sent to ${s.guardian}`); }}><Bell /></Button>}
                    {st !== "paid" && <Button size="sm" variant="brand" onClick={() => setPay(i)}>Record payment</Button>}
                  </div></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Pager {...paged} />
      </Card>
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
      <Dialog open={remindOpen} onOpenChange={setRemindOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send fee reminders?</DialogTitle><DialogDescription>Every parent whose child still owes fees gets a notification with the balance and due date.</DialogDescription></DialogHeader>
          <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm"><span>Parents to remind</span><b>{owing.length}</b></div>
          <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm"><span>Total balance</span><b className="tabular-nums">{formatINR(owing.reduce((a, i) => a + i.totalPaise - i.paidPaise, 0))}</b></div>
          <DialogFooter><Button variant="secondary" onClick={() => setRemindOpen(false)}>Cancel</Button>
            <Button variant="brand" loading={is("remind")} onClick={() => run("remind", () => { remind(owing); setRemindOpen(false); toast.success(`Reminders sent to ${owing.length} parents`); })}>Send reminders</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!pay} onOpenChange={(o) => !o && setPay(null)}>
        <DialogContent>
          {pay && (
            <>
              <DialogHeader>
                <DialogTitle>Record payment</DialogTitle>
                <DialogDescription>{student(pay.studentId).name} · {pay.no} · {formatINR(pay.totalPaise - pay.paidPaise)} due</DialogDescription>
              </DialogHeader>
              <form onSubmit={record} className="flex flex-col gap-4">
                <Field label="Amount received (₹)" htmlFor="amount"><Input id="amount" name="amount" inputMode="decimal" defaultValue={(pay.totalPaise - pay.paidPaise) / 100} required /></Field>
                <Field label="Paid by" htmlFor="mode"><NativeSelect id="mode" name="mode"><option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="bank_transfer">Bank transfer</option></NativeSelect></Field>
                <Field label="Reference" htmlFor="ref" hint="Cheque number or UPI reference. Optional for cash."><Input id="ref" name="ref" /></Field>
                <p className="text-xs text-text-tertiary">Time of receipt is recorded automatically in IST.</p>
                <DialogFooter><Button type="button" variant="secondary" onClick={() => setPay(null)}>Cancel</Button><Button type="submit" variant="brand" loading={is("pay")}>Save payment</Button></DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
