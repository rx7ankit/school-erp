"use client";
import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { BarChart } from "@/components/app/bar-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SCHOOLS, billable, invoicesFor, mrrSeries, type PlatformInvoice } from "@/lib/platform-mock";
import { formatINR, formatIST, nowUTC } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { useTodayIST } from "@/lib/use-today";

const monthLabel = (ym: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));

export default function OwnerRevenue() {
  const today = useTodayIST();
  const [paid, setPaid] = React.useState<Record<string, string>>({});
  const { run, pending } = usePending(700);
  const mrr = SCHOOLS.reduce((a, s) => a + billable(s), 0);
  const all: (PlatformInvoice & { school: string })[] = today ? SCHOOLS.flatMap((s) => invoicesFor(s, today).map((i) => ({ ...i, school: s.name }))) : [];
  const latest = all.length ? all.map((i) => i.ym).sort().at(-1)! : "";
  const rows = all.filter((i) => i.ym === latest);
  const isPaid = (i: PlatformInvoice) => i.status === "paid" || !!paid[i.id];
  const billed = rows.reduce((a, i) => a + i.amountPaise, 0);
  const collected = rows.filter(isPaid).reduce((a, i) => a + i.amountPaise, 0);
  const series = today ? mrrSeries(mrr, today) : [];

  return (
    <>
      <PageHeader eyebrow={latest ? monthLabel(latest) : ""} title="Revenue." dim="Billed, collected, waiting." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Billed" value={formatINR(billed)} hint="Last full month" />
        <StatCard label="Collected" value={formatINR(collected)} hint={billed ? `${Math.round((collected / billed) * 100)}% of billed` : undefined} />
        <StatCard label="Waiting" value={formatINR(billed - collected)} />
        <StatCard label="Monthly revenue now" value={formatINR(mrr)} hint="Active schools" />
      </div>
      <Card>
        <CardHeader><div><CardTitle>Revenue by month</CardTitle><CardDescription>In ₹ thousand</CardDescription></div></CardHeader>
        {series.length > 0 && <BarChart label="Monthly revenue for the last twelve months" data={series.map((m) => ({ label: m.label, value: m.paise / 100_000 }))} format={(v) => `${v}k`} />}
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Invoices</CardTitle><CardDescription>{latest && monthLabel(latest)}. Payments are recorded here after the school pays you.</CardDescription></div></CardHeader>
        <Table className="min-w-[700px]">
          <TableHeader><TableRow><TableHead>School</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.school}</TableCell>
                <TableCell className="text-right tabular-nums">{i.students}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(i.amountPaise)}</TableCell>
                <TableCell>{isPaid(i) ? <Badge tone="success">Paid {formatIST(paid[i.id] ?? i.paidAt!, "short")}</Badge> : <Badge tone="warning">Due</Badge>}</TableCell>
                <TableCell className="text-right">{!isPaid(i) && <Button size="sm" variant="brand" loading={pending === i.id} onClick={() => run(i.id, () => { setPaid((p) => ({ ...p, [i.id]: nowUTC() })); toast.success(`Payment recorded for ${i.school}`); })}>Mark paid</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
