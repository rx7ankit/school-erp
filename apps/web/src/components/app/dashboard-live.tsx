"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays, GraduationCap, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/session-provider";
import { useDashboardCounts } from "@/lib/api/hooks/dashboard";
import { formatDateOn } from "@/lib/time";

/** The staff dashboard on the real API. Only numbers the API gives are shown; the rest says "coming soon". */
export function DashboardLive() {
  const { me } = useSession();
  const canStaff = !!me && (me.is_admin || me.permissions.includes("staff.manage"));
  const canAcademic = !!me && (me.is_admin || me.permissions.includes("academic.manage"));
  const d = useDashboardCounts(canStaff);
  if (!me) return null;
  const first = me.name.split(" ")[0];
  const loading = d.years.isPending || (d.hasCurrent && d.classes.isPending);
  const dash = "–";

  return (
    <>
      <PageHeader eyebrow={d.year ? `Academic year ${d.year.name}` : me.school?.name} title={`Good day, ${first}.`} dim="Here is your school today." />

      {!loading && !d.hasCurrent ? (
        <EmptyState icon={CalendarDays} title="No current academic year" text="Add an academic year and make it current to start setting up classes, subjects and teachers."
          action={canAcademic ? <Button asChild variant="brand"><Link href="/academic">Open academic setup</Link></Button> : undefined} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Classes" value={loading ? dash : d.classes.data?.items.length ?? dash} hint={d.year ? `in ${d.year.name}` : undefined} />
          <StatCard label="Students" value={loading ? dash : d.students} hint="Enrolled in a class" />
          {canStaff && <StatCard label="Staff" value={d.staff.data ? d.staff.data.items.filter((s) => s.is_active).length : dash} hint="Active on the roster" />}
          {d.classes.data && <StatCard label="Without class teacher" value={d.withoutTeacher} hint={d.withoutTeacher ? "Assign them in Academic" : "Every class has one"} />}
        </div>
      )}

      {me.assignments.length > 0 && d.classes.data && (
        <Card>
          <CardHeader><CardTitle>My classes</CardTitle></CardHeader>
          <ul className="flex flex-col">
            {me.assignments.map((a, i) => {
              const c = d.classes.data!.items.find((x) => x.id === a.class_id);
              if (!c) return null;
              return (
                <li key={`${a.class_id}-${a.subject_id ?? "ct"}-${i}`} className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
                  <div><p className="font-medium">Class {c.grade}-{c.section}</p><p className="text-[13px] text-muted-foreground">{c.students} students</p></div>
                  <span className="text-[13px] text-muted-foreground">{a.role === "class_teacher" ? "Class teacher" : "Subject teacher"}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {d.year && (
        <Card>
          <CardHeader><CardTitle>Current year</CardTitle></CardHeader>
          <p className="text-sm text-muted-foreground"><b className="text-foreground">{d.year.name}</b> runs from {formatDateOn(d.year.starts_on)} to {formatDateOn(d.year.ends_on)}.</p>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Attendance, fees, notices and timetable</CardTitle></CardHeader>
        <p className="text-sm text-muted-foreground">These will show up here as they come online. Nothing is shown until the real data is available.</p>
      </Card>

      <div className="flex flex-wrap gap-2.5">
        {canAcademic && <Button asChild variant="secondary"><Link href="/academic"><GraduationCap /> Academic setup</Link></Button>}
        {canStaff && <Button asChild variant="ghost"><Link href="/staff"><Users /> Staff <ArrowRight /></Link></Button>}
      </div>
    </>
  );
}
