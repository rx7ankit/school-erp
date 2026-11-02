"use client";
import { isLive } from "@/lib/api/config";
import { LiveRevenue } from "@/components/app/owner-live";
import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { ExportButton } from "@/components/app/export-button";
import { rupees } from "@/lib/export";
import { StatCard } from "@/components/app/stat-card";
import { BarChart } from "@/components/app/bar-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SCHOOLS, billable, invoicesFor, mrrSeries, type PlatformInvoice } from "@/lib/platform-mock";
import { formatINR, formatIST, nowUTC } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { useTodayIST } from "@/lib/use-today";

const monthLabel = (ym: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${ym}-01T00:00:00Z`));

function DemoRevenue() {
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
      <PageHeader title="Revenue."
        actions={<ExportButton fileName="revenue" build={() => [
          { name: "Invoices", headers: ["Month", "School", "Students", "Amount (₹)", "Status", "Paid on (IST)"], rows: all.map((i) => [monthLabel(i.ym), i.school, i.students, rupees(i.amountPaise), isPaid(i) ? "Paid" : "Due", paid[i.id] ? formatIST(paid[i.id]) : i.paidAt ? formatIST(i.paidAt) : ""]) },
          { name: "Monthly revenue", headers: ["Month", "Revenue (₹)"], rows: series.map((m) => [m.label, rupees(m.paise)]) }]} />} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Billed" value={formatINR(billed)} />
        <StatCard label="Collected" value={formatINR(collected)} />
        <StatCard label="Waiting" value={formatINR(billed - collected)} />
        <StatCard label="Monthly" value={formatINR(mrr)} />
      </div>
      <Card>
        <CardHeader><div><CardTitle>By month</CardTitle></div></CardHeader>
        {series.length > 0 && <BarChart label="Monthly revenue for the last twelve months" data={series.map((m) => ({ label: m.label, value: m.paise / 100_000 }))} format={(v) => `${v}k`} />}
      </Card>
      <Card>
        <CardHeader><div><CardTitle>{latest ? monthLabel(latest) : "Invoices"}</CardTitle></div></CardHeader>
        <Table className="min-w-[700px]">
          <TableHeader><TableRow><TableHead>School</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.school}</TableCell>
                <TableCell className="text-right tabular-nums">{i.students}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(i.amountPaise)}</TableCell>
                <TableCell>{isPaid(i) ? <Badge tone="success">Paid {formatIST(paid[i.id] ?? i.paidAt!, "short")}</Badge> : <Badge tone="warning">Due</Badge>}</TableCell>
                <TableCell className="text-right">{!isPaid(i) && <Button size="sm" variant="brand" loading={pending === i.id} onClick={() => run(i.id, () => { setPaid((p) => ({ ...p, [i.id]: nowUTC() })); toast.success("Recorded"); })}>Paid</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export default function OwnerRevenue() { return isLive ? <LiveRevenue /> : <DemoRevenue />; }
