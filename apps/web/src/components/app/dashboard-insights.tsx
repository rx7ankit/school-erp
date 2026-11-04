"use client";
import * as React from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { HBarList, LineChart } from "@/components/app/charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Appear, SkBars, SkCard, SkChart } from "@/components/ui/skeleton";
import { useHolidays } from "@/lib/api/hooks/attendance";
import { useAttendanceAnalytics, useFeesAnalytics } from "@/lib/api/hooks/analytics";
import { formatDateOn, formatINR } from "@/lib/time";
import { useTodayIST } from "@/lib/use-today";

const r1 = (n: number) => Math.round(n * 10) / 10;
const daysAgo = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const KIND_TONE = { holiday: "neutral", exam: "warning", event: "brand" } as const;

/**
 * The charts under the headline numbers on the staff dashboard. Every card draws from an endpoint the Analytics pages
 * already use, and a card with nothing to show is left out instead of shown empty.
 */
export function DashboardInsights({ showFees }: { showFees: boolean }) {
  const today = useTodayIST();
  const from = today ? daysAgo(today, 29) : "";
  const attQ = useAttendanceAnalytics(from, today);
  const feesQ = useFeesAnalytics(showFees);
  const holidaysQ = useHolidays();
  const att = attQ.data, fees = feesQ.data, holidays = holidaysQ.data;
  // Until the first answers are in, hold the places the cards will take so nothing jumps.
  if (!today || attQ.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-3" role="status" aria-busy="true">
        <span className="sr-only">Loading</span>
        <SkCard className="lg:col-span-2" height={0}><SkChart height={220} /></SkCard>
        <SkCard height={0}><SkBars rows={4} /></SkCard>
      </div>
    );
  }

  const trend = (att?.trend ?? []).filter((t) => t.percentage !== null).map((t) => ({ label: formatDateOn(t.day_on, "short"), value: r1(t.percentage!) }));
  const lowest = (att?.by_class ?? []).filter((c) => c.percentage !== null).sort((a, b) => a.percentage! - b.percentage!).slice(0, 4);
  const upcoming = (holidays ?? []).filter((h) => h.to_on >= today).sort((a, b) => a.from_on.localeCompare(b.from_on)).slice(0, 4);

  return (
    <>
      <Appear i={2} className="grid gap-4 lg:grid-cols-3">
        {trend.length > 1 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div><CardTitle>Attendance</CardTitle><CardDescription>Last 30 days</CardDescription></div>
              {att?.overall_percentage != null && <span className="text-[26px] font-bold leading-none tracking-tight tabular-nums">{r1(att.overall_percentage)}%</span>}
            </CardHeader>
            <LineChart height={190} label="Daily attendance percentage" data={trend} min={Math.max(0, Math.floor(Math.min(...trend.map((t) => t.value)) / 10) * 10 - 10)} max={100} />
          </Card>
        )}
        {fees && fees.billed_paise > 0 && (
          <Card>
            <CardHeader><div><CardTitle>Fees</CardTitle><CardDescription>{fees.year ?? "This year"}</CardDescription></div></CardHeader>
            <p className="text-[30px] font-bold leading-[1.1] tracking-[-0.03em] tabular-nums">{formatINR(fees.collected_paise)}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">collected of {formatINR(fees.billed_paise)} billed</p>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-fill"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, fees.collection_percentage ?? 0)}%` }} /></div>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-text-tertiary">Dues</dt><dd className="mt-0.5 font-semibold tabular-nums">{formatINR(fees.dues_paise)}</dd></div>
              <div><dt className="text-text-tertiary">Overdue</dt><dd className="mt-0.5 font-semibold tabular-nums text-destructive">{formatINR(fees.overdue_paise)}</dd></div>
            </dl>
          </Card>
        )}
      </Appear>

      <Appear i={3} className="grid gap-4 lg:grid-cols-2">
        {upcoming.length > 0 && (
          <Card>
            <CardHeader><div><CardTitle>Coming up</CardTitle><CardDescription>Next dates</CardDescription></div><Link href="/academic" className="text-sm font-medium">All</Link></CardHeader>
            <ul className="flex flex-col gap-4">
              {upcoming.map((h) => (
                <li key={h.id} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-fill text-muted-foreground"><CalendarDays className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{h.title}</p>
                    <p className="text-[13px] text-muted-foreground">{formatDateOn(h.from_on, "short")}{h.to_on !== h.from_on ? ` – ${formatDateOn(h.to_on, "short")}` : ""}</p>
                  </div>
                  <Badge tone={KIND_TONE[h.kind as keyof typeof KIND_TONE] ?? "neutral"} className="capitalize">{h.kind}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {lowest.length > 0 && (
          <Card>
            <CardHeader><div><CardTitle>Needs a look</CardTitle><CardDescription>Lowest attendance</CardDescription></div></CardHeader>
            <HBarList rows={lowest.map((c) => ({ label: `Class ${c.class_label}`, value: r1(c.percentage!), hint: `${c.students} students` }))} warnBelow={90} />
          </Card>
        )}
      </Appear>
    </>
  );
}
