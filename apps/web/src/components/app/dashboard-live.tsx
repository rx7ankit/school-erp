"use client";
import Link from "next/link";
import { CalendarCheck, CalendarDays, GraduationCap, UserCheck, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Appear, SkBars, SkCard, SkChart, SkHeader, SkPage, SkStatGrid } from "@/components/ui/skeleton";
import { DashboardInsights } from "@/components/app/dashboard-insights";
import { useSession } from "@/components/session-provider";
import { ApiError } from "@/lib/api/client";
import { useDashboard, useDashboardClasses } from "@/lib/api/hooks/dashboard";
import { isConnected } from "@/lib/features";
import { formatINR } from "@/lib/time";

/** Greeting by India time, so a 7am login says morning wherever the browser is. */
const greeting = () => {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())) % 24;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${Math.round(n * 10) / 10}%`);

/** The staff dashboard on the real API: one GET /dashboard. A block the API sends as null is not shown at all. */
export function DashboardLive() {
  const { me } = useSession();
  const q = useDashboard();
  const d = q.data;
  const classes = useDashboardClasses(!!me && me.assignments.length > 0);
  if (!me) return null;
  const first = me.name.split(" ")[0];
  const canAcademic = me.is_admin || me.permissions.includes("academic.manage");

  if (q.isPending) {
    return (
      <SkPage>
        <SkHeader actions={2} />
        <SkStatGrid />
        <div className="grid gap-4 lg:grid-cols-3">
          <SkCard className="lg:col-span-2" height={0}><SkChart height={220} /></SkCard>
          <SkCard height={0}><SkBars rows={4} /></SkCard>
        </div>
      </SkPage>
    );
  }
  if (q.isError) {
    const noYear = q.error instanceof ApiError && q.error.code === "no_current_year";
    return (
      <>
        <PageHeader title={`Hi, ${first}`} />
        {noYear ? (
          <EmptyState icon={CalendarDays} title="No academic year"
            action={canAcademic ? <Button asChild variant="brand"><Link href="/academic">Set up year</Link></Button> : undefined} />
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 text-sm text-destructive">
            <span>{q.error instanceof ApiError ? q.error.message : "Something went wrong. Please try again."}</span>
            <Button size="sm" variant="secondary" onClick={() => q.refetch()}>Retry</Button>
          </div>
        )}
      </>
    );
  }

  const att = d!.attendance;
  const roll = d!.rollover;

  return (
    <>
      <Appear><PageHeader
        title={`${greeting()}, ${first}`}
        actions={
          <>
            {isConnected("/fees") && d!.fees && <Button asChild variant="secondary"><Link href="/fees">Collect fee</Link></Button>}
            {isConnected("/attendance") && <Button asChild variant="brand"><Link href="/attendance">Mark attendance</Link></Button>}
          </>
        }
      /></Appear>

      {roll?.show_banner && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="font-bold">{roll.current_year ?? d!.year} {roll.days_left !== null && roll.days_left >= 0 ? `ends in ${roll.days_left} ${roll.days_left === 1 ? "day" : "days"}` : "has ended"}</p>
          {isConnected("/promotion") && <Button asChild variant="brand"><Link href="/promotion">Year-end</Link></Button>}
        </Card>
      )}

      <Appear i={1} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Students" value={d!.students.toLocaleString("en-IN")} hint={`${d!.classes} ${d!.classes === 1 ? "class" : "classes"}`} />
        <StatCard icon={CalendarCheck} label="Attendance today" value={pct(att.today_percentage)} hint={att.month_percentage != null ? `${pct(att.month_percentage)} this month` : undefined} />
        {d!.fees && <StatCard solid icon={Wallet} label="Collected this month" value={formatINR(d!.fees.collected_this_month_paise)} hint={`${formatINR(d!.fees.dues_paise)} dues · ${d!.fees.dues_students} students`} />}
        {d!.staff && <StatCard icon={UserCheck} label="Staff present" value={`${d!.staff.present_today}/${d!.staff.active_staff}`} hint={d!.staff.not_marked_today > 0 ? `${d!.staff.not_marked_today} not marked` : d!.staff.absent_today > 0 ? `${d!.staff.absent_today} absent` : undefined} />}
        {!d!.fees && !d!.staff && <StatCard label="This month" value={pct(att.month_percentage)} />}
      </Appear>

      <DashboardInsights showFees={!!d!.fees} />

      {me.assignments.length > 0 && classes.data && (
        <Card>
          <CardHeader><CardTitle>My classes</CardTitle></CardHeader>
          <ul className="flex flex-col">
            {me.assignments.map((a, i) => {
              const c = classes.data.items.find((x) => x.id === a.class_id);
              if (!c) return null;
              return (
                <li key={`${a.class_id}-${a.subject_id ?? "ct"}-${i}`} className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
                  <div><p className="font-medium">Class {c.grade}-{c.section}</p><p className="text-[13px] text-muted-foreground">{c.students} students</p></div>
                  <Badge tone={a.role === "class_teacher" ? "brand" : "neutral"}>{a.role === "class_teacher" ? "Class teacher" : "Subject"}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
