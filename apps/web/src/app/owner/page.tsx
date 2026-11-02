"use client";
import { isLive } from "@/lib/api/config";
import { LiveOverview } from "@/components/app/owner-live";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { BarChart } from "@/components/app/bar-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SCHOOLS, billable, invoicesFor, mrrSeries } from "@/lib/platform-mock";
import { formatINR } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const TONE = { active: "success", trial: "warning", suspended: "danger" } as const;

function DemoOverview() {
  const today = useTodayIST();
  const active = SCHOOLS.filter((s) => s.status === "active");
  const students = active.reduce((a, s) => a + s.students, 0);
  const mrr = SCHOOLS.reduce((a, s) => a + billable(s), 0);
  const newThisMonth = today ? SCHOOLS.filter((s) => s.createdAt.slice(0, 7) === today.slice(0, 7)).length : 0;
  const dueInv = today ? SCHOOLS.flatMap((s) => invoicesFor(s, today)).filter((i) => i.status === "due") : [];
  const dueTotal = dueInv.reduce((a, i) => a + i.amountPaise, 0);
  const series = today ? mrrSeries(mrr, today) : [];

  return (
    <>
      <PageHeader title="Overview." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Schools" value={SCHOOLS.length} />
        <StatCard label="Students" value={students.toLocaleString("en-IN")} />
        <StatCard label="Monthly" value={formatINR(mrr)} />
        <StatCard label="Yearly" value={formatINR(mrr * 12)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader><div><CardTitle>Revenue</CardTitle></div></CardHeader>
          {series.length > 0 && <BarChart label="Monthly recurring revenue for the last twelve months" data={series.map((m) => ({ label: m.label, value: m.paise / 100_000 }))} format={(v) => `${v}k`} />}
        </Card>
        <Card className="flex flex-col gap-5">
          <CardHeader className="mb-0"><CardTitle>This month</CardTitle></CardHeader>
          <div><p className="text-xs uppercase tracking-[0.06em] text-text-tertiary">New schools</p><p className="text-[28px] font-bold tabular-nums">{newThisMonth}</p></div>
          <div><p className="text-xs uppercase tracking-[0.06em] text-text-tertiary">Unpaid</p><p className="text-[28px] font-bold tabular-nums">{formatINR(dueTotal)}</p></div>
          <Link href="/owner/revenue" className="mt-auto flex items-center gap-1 text-sm font-medium text-foreground">Revenue <ArrowRight className="size-4" /></Link>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Newest schools</CardTitle><Link href="/owner/schools" className="text-sm font-medium text-foreground">All</Link></CardHeader>
        <ul>
          {[...SCHOOLS].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1"><Link href={`/owner/schools/${s.id}`} className="font-medium hover:underline">{s.name}</Link><p className="text-xs text-text-tertiary">{s.city}</p></div>
              <span className="text-sm tabular-nums text-muted-foreground">{s.students}</span>
              <Badge tone={TONE[s.status]} className="capitalize">{s.status}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export default function OwnerOverview() { return isLive ? <LiveOverview /> : <DemoOverview />; }
