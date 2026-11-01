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

  const billed = rows.reduce((s, i) => s + i.totalPaise, 0);
  const collected = rows.reduce((s, i) => s + i.paidPaise, 0);
  const student = (id: string) => STUDENTS.find((s) => s.id === id)!;
  const shown = rows.filter((i) => (filter === "all" || invoiceStatus(i) === filter) && student(i.studentId).name.toLowerCase().includes(q.toLowerCase()));

  const paged = usePaged(shown, 12);

  function record(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pay) return;
    const f = new FormData(e.currentTarget);
    const paise = Math.round(Number(f.get("amount")) * 100);
    const due = pay.totalPaise - pay.paidPaise;
    if (!(paise > 0) || paise > due) { toast.error(`Enter an amount up to ${formatINR(due)}`); return; }
    const at = nowUTC();
    setRows((r) => r.map((x) => (x.id === pay.id ? { ...x, paidPaise: x.paidPaise + paise, lastPaymentAt: at, mode: f.get("mode") as FeeMode } : x)));
    toast.success(`Recorded ${formatINR(paise)}`, { description: `Receipt RCP-${Date.now().toString().slice(-5)} · ${formatIST(at)} IST` });
    setPay(null);
  }

  return (
    <>
      <PageHeader eyebrow="Term 2 · 2026–27" title="Fees." dim="Record what you collect." />
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
            <Input aria-label="Search invoices" className="rounded-full bg-background pl-10" placeholder="Search student" value={q} onChange={(e) => setQ(e.target.value)} />
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
                  <TableCell className="text-right">{st !== "paid" && <Button size="sm" variant="brand" onClick={() => setPay(i)}>Record payment</Button>}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Pager {...paged} />
      </Card>
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
                <DialogFooter><Button type="button" variant="secondary" onClick={() => setPay(null)}>Cancel</Button><Button type="submit" variant="brand">Save payment</Button></DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
