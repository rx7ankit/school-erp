"use client";
import Link from "next/link";
import { ArrowRight, CheckSquare, GraduationCap, MessageSquare, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Can } from "@/components/app/can";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/components/session-provider";
import { BOOKS, CLASSES, SCHOOL, HOLIDAYS, INVOICES, NOTICES, STAFF, STUDENTS, className } from "@/lib/mock";
import { formatDateOn, formatINR, formatIST } from "@/lib/time";
import { DayList } from "@/components/app/timetable/day-list";
import { useLeaves } from "@/lib/leave";
import { classIdsFor } from "@/lib/permissions";
import { dayForTeacher, needsCover, uncoveredCount, useNowIST, useTimetable } from "@/lib/timetable";
import { useTodayIST } from "@/lib/use-today";

export default function DashboardPage() {
  const { user } = useSession();
  const leaves = useLeaves();
  useTimetable();
  const today = useTodayIST();
  const now = useNowIST();
  if (!user) return null;
  const canCover = user.isAdmin || user.permissions.includes("staff.manage");
  const isClassTeacher = user.isAdmin || user.classes.some((c) => c.role === "class_teacher");
  const myIds = classIdsFor(user, "class_teacher", CLASSES.map((c) => c.id));
  const pendingLeaves = leaves.filter((l) => l.status === "pending" && myIds.includes(STUDENTS.find((x) => x.id === l.studentId)?.classId ?? "")).length;
  const myDay = today && user.classes.length > 0 ? dayForTeacher(today, user.id) : [];
  const coverRows = today ? needsCover(today) : [];
  const first = user.name.split(" ")[0];
  const collected = INVOICES.reduce((s, i) => s + i.paidPaise, 0);
  const billed = INVOICES.reduce((s, i) => s + i.totalPaise, 0);
  const absent = STAFF.filter((s) => s.absentToday).length;
  const myClasses = user.isAdmin ? [] : user.classes;
  const issued = BOOKS.reduce((s, b) => s + b.issued, 0);

  return (
    <>
      <PageHeader eyebrow={`Term 2 · ${SCHOOL.year}`} title={`Good day, ${first}.`} dim="Here is your school today." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={STUDENTS.length} hint={`${CLASSES.length} classes`} />
        <StatCard label="Staff present" value={`${STAFF.length - absent}/${STAFF.length}`} hint={absent ? `${absent} on leave today` : "Everyone is in"} />
        <Can access="fees.manage"><StatCard label="Fees collected" value={formatINR(collected)} hint={`of ${formatINR(billed)} · ${Math.round((collected / billed) * 100)}%`} /></Can>
        <Can access="library.manage"><StatCard label="Books issued" value={issued} hint={`${BOOKS.length} titles`} /></Can>
        {canCover && <Link href="/timetable?tab=substitutes" aria-label="Needs cover, open substitutes" className="rounded-[20px] hover:bg-card-hover"><StatCard label="Needs cover" value={today ? uncoveredCount(today) : 0} hint={coverRows.length ? `of ${coverRows.length} periods today · Plan cover` : "No teacher needs cover"} /></Link>}
        {isClassTeacher && <Link href="/leave" aria-label="Pending leave requests, open" className="rounded-[20px] hover:bg-card-hover"><StatCard label="Leave requests" value={pendingLeaves} hint={pendingLeaves ? "Waiting for you" : "All caught up"} /></Link>}
      </div>

      {myDay.length > 0 && (
        <Card>
          <CardHeader><CardTitle>My day</CardTitle><Button asChild variant="link" size="sm"><Link href="/timetable">Full timetable</Link></Button></CardHeader>
          <DayList rows={myDay} now={now} compact />
        </Card>
      )}

      {myClasses.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Your classes</CardTitle></CardHeader>
          <ul className="flex flex-col">
            {myClasses.map((c) => (
              <li key={c.classId} className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
                <div>
                  <p className="font-medium">Class {className(c.classId)}</p>
                  <p className="text-[13px] text-muted-foreground">{STUDENTS.filter((s) => s.classId === c.classId).length} students</p>
                </div>
                <Badge tone={c.role === "class_teacher" ? "brand" : "neutral"}>{c.role === "class_teacher" ? "Class teacher" : "Subject teacher"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Notices</CardTitle><Can access="academic.manage"><Button asChild variant="link" size="sm"><Link href="/academic">Manage</Link></Button></Can></CardHeader>
          <ul className="flex flex-col">
            {NOTICES.map((n) => (
              <li key={n.id} className="border-t border-border py-3 first:border-t-0 first:pt-0">
                <p className="font-medium">{n.title}</p>
                <p className="text-[13px] text-muted-foreground">{formatIST(n.publishedAt)}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader><CardTitle>Coming up</CardTitle></CardHeader>
          <ul className="flex flex-col">
            {HOLIDAYS.slice(0, 3).map((h) => (
              <li key={h.id} className="border-t border-border py-3 first:border-t-0 first:pt-0">
                <p className="font-medium">{h.title}</p>
                <p className="text-[13px] text-muted-foreground">{formatDateOn(h.fromOn, "short")}{h.toOn !== h.fromOn && ` – ${formatDateOn(h.toOn, "short")}`}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Can access="class_teacher"><Button asChild variant="brand"><Link href="/attendance"><CheckSquare /> Mark attendance</Link></Button></Can>
        <Can access="assigned_class"><Button asChild variant="secondary"><Link href="/messages"><MessageSquare /> Message parents</Link></Button></Can>
        <Can access="fees.manage"><Button asChild variant="secondary"><Link href="/fees"><Wallet /> Record a payment</Link></Button></Can>
        <Button asChild variant="ghost"><Link href="/students"><GraduationCap /> View students <ArrowRight /></Link></Button>
      </div>
    </>
  );
}
