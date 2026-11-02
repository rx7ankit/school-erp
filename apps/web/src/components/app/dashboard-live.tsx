"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays, GraduationCap, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/session-provider";
import { ApiError } from "@/lib/api/client";
import { useDashboard, useDashboardClasses } from "@/lib/api/hooks/dashboard";
import { isConnected } from "@/lib/features";
import { formatINR } from "@/lib/time";

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
  const canStaff = me.is_admin || me.permissions.includes("staff.manage");

  if (q.isPending) return <><PageHeader eyebrow={me.school?.name} title={`Good day, ${first}.`} dim="Here is your school today." /><p className="text-sm text-muted-foreground">Loading…</p></>;
  if (q.isError) {
    const noYear = q.error instanceof ApiError && q.error.code === "no_current_year";
    return (
      <>
        <PageHeader eyebrow={me.school?.name} title={`Good day, ${first}.`} dim="Here is your school today." />
        {noYear ? (
          <EmptyState icon={CalendarDays} title="No current academic year" text="Add an academic year and make it current to start setting up classes, subjects and teachers."
            action={canAcademic ? <Button asChild variant="brand"><Link href="/academic">Open academic setup</Link></Button> : undefined} />
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 text-sm text-destructive">
            <span>{q.error instanceof ApiError ? q.error.message : "Something went wrong. Please try again."}</span>
            <Button size="sm" variant="secondary" onClick={() => q.refetch()}>Try again</Button>
          </div>
        )}
      </>
    );
  }

  const mine = d!.scope === "my_classes";
  const att = d!.attendance;
  const roll = d!.rollover;

  return (
    <>
      <PageHeader eyebrow={d!.year ? `Academic year ${d!.year}` : me.school?.name} title={`Good day, ${first}.`} dim={mine ? "Here are your classes today." : "Here is your school today."} />

      {roll?.show_banner && (
        <Card className="flex flex-wrap items-center gap-x-5 gap-y-3 bg-accent-subtle p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-brand"><GraduationCap className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Session {roll.current_year ?? d!.year} {roll.days_left !== null && roll.days_left >= 0 ? `ends in ${roll.days_left} ${roll.days_left === 1 ? "day" : "days"}` : "has ended"}.</p>
            <p className="text-sm text-muted-foreground">Move everyone up in a few calm steps.</p>
          </div>
          {isConnected("/promotion") && <Button asChild variant="brand"><Link href="/promotion">Start year-end</Link></Button>}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={d!.students.toLocaleString("en-IN")} hint={`${d!.classes} ${d!.classes === 1 ? "class" : "classes"}${mine ? " of yours" : ""}`} />
        <StatCard label="Attendance today" value={pct(att.today_percentage)} hint={att.classes_total ? `${att.classes_marked_today} of ${att.classes_total} classes marked` : "No classes"} />
        <StatCard label="Attendance this month" value={pct(att.month_percentage)} hint={att.month_percentage === null ? "No attendance marked yet" : undefined} />
        <StatCard label={d!.results.exam ? `Results · ${d!.results.exam}` : "Results"} value={pct(d!.results.average_percentage)} hint={d!.results.average_percentage === null ? "No results published yet" : "Average percentage"} />
        {d!.fees && <StatCard label="Fees collected" value={formatINR(d!.fees.collected_this_month_paise)} hint="This month" />}
        {d!.fees && <StatCard label="Fee dues" value={formatINR(d!.fees.dues_paise)} hint={d!.fees.dues_students ? `${d!.fees.dues_students} ${d!.fees.dues_students === 1 ? "student" : "students"}${d!.fees.overdue_paise ? ` · ${formatINR(d!.fees.overdue_paise)} overdue` : ""}` : "Nothing pending"} />}
        {d!.staff && <StatCard label="Staff present" value={`${d!.staff.present_today}/${d!.staff.active_staff}`} hint={`${d!.staff.absent_today} absent${d!.staff.not_marked_today ? ` · ${d!.staff.not_marked_today} not marked` : ""}`} />}
      </div>

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
                  <Badge tone={a.role === "class_teacher" ? "brand" : "neutral"}>{a.role === "class_teacher" ? "Class teacher" : "Subject teacher"}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2.5">
        {canAcademic && <Button asChild variant="secondary"><Link href="/academic"><GraduationCap /> Academic setup</Link></Button>}
        {canStaff && <Button asChild variant="ghost"><Link href="/staff"><Users /> Staff <ArrowRight /></Link></Button>}
      </div>
    </>
  );
}
