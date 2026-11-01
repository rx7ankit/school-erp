"use client";
import * as React from "react";
import Link from "next/link";
import { Bell, Eye, Receipt as ReceiptIcon, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { StatCard } from "@/components/app/stat-card";
import { useCan } from "@/components/app/can";
import { Pager, usePaged } from "@/components/app/pager";
import { ExportButton } from "@/components/app/export-button";
import { ReceiptDialog } from "@/components/app/receipt-dialog";
import { InvoiceDetailDialog } from "@/components/app/fees/invoice-detail-dialog";
import { RecordPaymentDialog } from "@/components/app/fees/record-payment-dialog";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { applyLateFees, billedOf, isClosed, owedOf, useFeesStore } from "@/lib/fees-setup";
import { INVOICES, STUDENTS, className, invoiceStatus, type FeePayment, type Invoice } from "@/lib/mock";
import { MODE_LABEL, receiptFor, type Receipt } from "@/lib/receipt";
import { formatINR, formatIST, todayOnIST } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { notify } from "@/lib/notifications";
import { rupees } from "@/lib/export";

const TONE = { paid: "success", partial: "warning", unpaid: "danger" } as const;
const student = (id: string) => STUDENTS.find((s) => s.id === id)!;
const statusOf = (i: Invoice) => (isClosed(i) ? "closed" : invoiceStatus(i));

export default function FeesPage() {
  const can = useCan();
  return can("fees.manage") ? <FeesContent /> : <NoAccess need="the Fees permission" />;
}

function FeesContent() {
  useFeesStore();
  const { user } = useSession();
  const by = user?.name ?? "Staff";
  const [filter, setFilter] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [view, setView] = React.useState<string | null>(null);
  const [pay, setPay] = React.useState<Invoice | null>(null);
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const [remindOpen, setRemindOpen] = React.useState(false);
  const { run, is } = usePending();

  // The system adds late fees once an invoice is past its due date plus grace days.
  React.useEffect(() => { applyLateFees(todayOnIST()); }, []);

  const rows = INVOICES;
  const billed = rows.reduce((s, i) => s + billedOf(i), 0);
  const collected = rows.reduce((s, i) => s + i.paidPaise, 0);
  const pending = rows.reduce((s, i) => s + owedOf(i), 0);
  const owing = rows.filter((i) => owedOf(i) > 0 && student(i.studentId).status === "active");
  const remind = (list: Invoice[]) => notify(list.map((i) => ({ type: "fee_reminder" as const, studentId: i.studentId, params: { amountPaise: owedOf(i), dueOn: i.dueOn } })));
  const shown = rows.filter((i) => (filter === "all" || statusOf(i) === filter) && student(i.studentId).name.toLowerCase().includes(q.toLowerCase()));
  const paged = usePaged(shown, 12);
  const viewing = rows.find((i) => i.id === view) ?? null;
  const lastActive = (i: Invoice): FeePayment | undefined => [...i.payments].filter((p) => p.status === "active").sort((a, b) => a.at.localeCompare(b.at)).at(-1);

  return (
    <>
      <PageHeader eyebrow="Fees · 2026–27" title="Fees." dim="Record what you collect."
        actions={<>
          <Button variant="secondary" asChild><Link href="/fees/setup"><Settings2 /> Setup</Link></Button>
          <ExportButton fileName="fees" build={() => [
            { name: "Fees", headers: ["Invoice", "Period", "Student", "Class", "Scholar no.", "Total (₹)", "Paid (₹)", "Balance (₹)", "Status", "Last payment (IST)", "Paid by"],
              rows: rows.map((i) => { const st = student(i.studentId); return [i.no, i.period, st.name, className(st.classId), st.scholarNo, rupees(i.totalPaise), rupees(i.paidPaise), rupees(owedOf(i)), statusOf(i), i.lastPaymentAt ? formatIST(i.lastPaymentAt) : "", i.mode ? MODE_LABEL[i.mode] : ""]; }) },
            { name: "Payments", headers: ["Receipt no.", "Invoice", "Student", "Amount (₹)", "Mode", "Reference", "Date and time (IST)", "Received by", "Status", "Cancel reason"],
              rows: rows.flatMap((i) => i.payments.map((p) => [p.receiptNo, i.no, student(i.studentId).name, rupees(p.amountPaise), MODE_LABEL[p.mode], p.reference ?? "", formatIST(p.at), p.receivedBy, p.status, p.cancelReason ?? ""])) },
          ]} />
          <Button variant="brand" disabled={!owing.length} onClick={() => setRemindOpen(true)}><Bell /> Send reminders ({owing.length})</Button>
        </>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Billed" value={formatINR(billed)} />
        <StatCard label="Collected" value={formatINR(collected)} hint={billed ? `${Math.round((collected / billed) * 100)}% of billed` : undefined} />
        <StatCard label="Pending" value={formatINR(pending)} hint={`${owing.length} students owe fees`} />
      </div>
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={filter} onValueChange={(v) => { setFilter(v); paged.setPage(0); }}>
            <TabsList>{["all", "unpaid", "partial", "paid"].map((f) => <TabsTrigger key={f} value={f} className="capitalize">{f}</TabsTrigger>)}</TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
            <Input aria-label="Search invoices" className="rounded-full pl-10" placeholder="Search student" value={q} onChange={(e) => { setQ(e.target.value); paged.setPage(0); }} />
          </div>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Student</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {paged.rows.map((i) => {
              const st = statusOf(i), s = student(i.studentId), lp = lastActive(i);
              return (
                <TableRow key={i.id}>
                  <TableCell className="tabular-nums text-muted-foreground">{i.no}<p className="text-xs text-text-tertiary">{i.period}</p></TableCell>
                  <TableCell><p className="font-medium">{s.name}</p><p className="text-xs text-text-tertiary">Class {className(s.classId)}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(i.totalPaise)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(i.paidPaise)}{i.lastPaymentAt && <p className="text-xs text-text-tertiary">{formatIST(i.lastPaymentAt, "short")}</p>}</TableCell>
                  <TableCell>{st === "closed" ? <Badge className="capitalize">Closed</Badge> : <Badge tone={TONE[st]} className="capitalize">{st}</Badge>}</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1.5">
                    {lp && <Button size="icon-sm" variant="ghost" aria-label="Latest receipt" onClick={() => setReceipt(receiptFor(i, lp))}><ReceiptIcon /></Button>}
                    {owedOf(i) > 0 && <Button size="icon-sm" variant="ghost" aria-label="Send reminder" onClick={() => { remind([i]); toast.success(`Reminder sent to ${s.guardian}`); }}><Bell /></Button>}
                    <Button size="sm" variant="secondary" onClick={() => setView(i.id)}><Eye /> View</Button>
                    {owedOf(i) > 0 && <Button size="sm" variant="brand" onClick={() => setPay(i)}>Record payment</Button>}
                  </div></TableCell>
                </TableRow>
              );
            })}
            {!paged.rows.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No invoices match.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <Pager {...paged} />
      </Card>
      <InvoiceDetailDialog invoice={viewing} by={by} onClose={() => setView(null)} onRecord={setPay} onReceipt={setReceipt} />
      <RecordPaymentDialog invoice={pay} by={by} onClose={() => setPay(null)} onSaved={(inv, p) => setReceipt(receiptFor(inv, p))} />
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
      <Dialog open={remindOpen} onOpenChange={setRemindOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send fee reminders?</DialogTitle><DialogDescription>Every parent whose child still owes fees gets a notification with the balance and due date.</DialogDescription></DialogHeader>
          <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm"><span>Parents to remind</span><b>{owing.length}</b></div>
          <div className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm"><span>Total balance</span><b className="tabular-nums">{formatINR(owing.reduce((a, i) => a + owedOf(i), 0))}</b></div>
          <DialogFooter><Button variant="secondary" onClick={() => setRemindOpen(false)}>Cancel</Button>
            <Button variant="brand" loading={is("remind")} onClick={() => run("remind", () => { remind(owing); setRemindOpen(false); toast.success(`Reminders sent to ${owing.length} parents`); })}>Send reminders</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
