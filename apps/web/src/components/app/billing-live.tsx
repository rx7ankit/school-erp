"use client";
import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { NoAccess } from "@/components/app/no-access";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { InvoiceBadge, monthLabel } from "@/components/app/owner-live-billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Appear, SkPage, SkStatGrid, SkTableRows } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/components/session-provider";
import { useSchoolBilling } from "@/lib/api/hooks/billing";
import { errorText } from "@/lib/api/hooks/staff";
import { formatDateOn, formatINR, formatIST } from "@/lib/time";

const PLAN: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  active: { label: "Active", tone: "success" }, trial: { label: "On trial", tone: "warning" }, suspended: { label: "Suspended", tone: "danger" },
};

/** The school's own Krevo subscription, read-only. Admin only (the API answers 403 to anyone else). */
export function BillingLive() {
  const { me } = useSession();
  const q = useSchoolBilling(!!me?.is_admin);
  if (!me) return null;
  if (!me.is_admin) return <NoAccess need="admin access" />;
  const head = <PageHeader eyebrow="Admin only" title="Billing." dim="Your Krevo subscription." />;
  if (q.isPending) return (
    <>
      {head}
      <SkPage>
        <SkStatGrid count={4} />
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <Table className="min-w-[640px]">
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Due on</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody><SkTableRows cols={6} rows={4} /></TableBody>
          </Table>
        </Card>
      </SkPage>
    </>
  );
  if (q.isError) return <>{head}<div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 text-sm text-destructive"><span>{errorText(q.error)}</span><Button size="sm" variant="secondary" onClick={() => q.refetch()}>Try again</Button></div></>;
  const b = q.data;
  const plan = PLAN[b.school_status] ?? PLAN.active;
  return (
    <>
      {head}
      <Appear className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Plan" value={<Badge tone={plan.tone}>{plan.label}</Badge>} hint={`Since ${formatDateOn(b.started_on)}`} />
        <StatCard label="Price" value={formatINR(b.price_per_student_paise)} hint="per student per month" />
        <StatCard label="Active students" value={b.active_students.toLocaleString("en-IN")} hint="Counted today" />
        <StatCard label={b.billed_now ? "This month, estimated" : "Monthly"} value={b.billed_now ? formatINR(b.estimated_monthly_paise) : "Free"} hint={b.billed_now ? "Billed after the month ends" : "No charge during the trial"} />
      </Appear>
      {b.outstanding_paise > 0 && (
        <Card className="appear flex flex-wrap items-center justify-between gap-3 bg-fill p-5">
          <div><p className="font-bold">{formatINR(b.outstanding_paise)} outstanding</p><p className="text-sm text-muted-foreground">Please pay the due invoices below and share the reference with the Krevo team.</p></div>
        </Card>
      )}
      <Appear i={1}><Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        {b.invoices.length === 0 ? <EmptyState icon={Receipt} title="No invoices yet" text={b.billed_now ? "Your first invoice is created when a month ends." : "Invoices start after the trial."} /> : (
          <Table className="min-w-[640px]">
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Students</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Due on</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{b.invoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{monthLabel(i.month)}</TableCell>
                <TableCell className="text-right tabular-nums">{i.active_students}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(i.price_per_student_paise)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatINR(i.amount_paise)}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{formatDateOn(i.due_on)}</TableCell>
                <TableCell><div className="flex items-center gap-2"><InvoiceBadge i={i} />{i.paid_at && <span className="text-xs text-text-tertiary">{formatIST(i.paid_at, "date")}</span>}</div></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </Card></Appear>
    </>
  );
}
