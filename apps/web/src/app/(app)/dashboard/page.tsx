"use client";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Can } from "@/components/app/can";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLive } from "@/components/app/dashboard-live";
import { useSession } from "@/components/session-provider";
import { YearEndBanner } from "@/components/app/rollover/year-end-banner";
import { ChecklistCard } from "@/components/app/rollover/checklist-card";
import { CLASSES, INVOICES, STUDENTS, className } from "@/lib/mock";
import { formatINR } from "@/lib/time";
import { useLeaves } from "@/lib/leave";
import { classIdsFor } from "@/lib/permissions";
import { uncoveredCount, useTimetable } from "@/lib/timetable";
import { useTodayIST } from "@/lib/use-today";

export default function DashboardPage() {
  const { live } = useSession();
  return live ? <DashboardLive /> : <DashboardDemo />;
}

function DashboardDemo() {
  const { user } = useSession();
  const leaves = useLeaves();
  useTimetable();
  const today = useTodayIST();
  if (!user) return null;
  const canCover = user.isAdmin || user.permissions.includes("staff.manage");
  const isClassTeacher = user.isAdmin || user.classes.some((c) => c.role === "class_teacher");
  const myIds = classIdsFor(user, "class_teacher", CLASSES.map((c) => c.id));
  const pendingLeaves = leaves.filter((l) => l.status === "pending" && myIds.includes(STUDENTS.find((x) => x.id === l.studentId)?.classId ?? "")).length;
  const first = user.name.split(" ")[0];
  const collected = INVOICES.reduce((s, i) => s + i.paidPaise, 0);
  const myClasses = user.isAdmin ? [] : user.classes;

  return (
    <>
      <PageHeader title={`Hi, ${first}`} />

      <YearEndBanner />
      <ChecklistCard />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={STUDENTS.length} />
        <Can access="fees.manage"><StatCard label="Collected" value={formatINR(collected)} /></Can>
        {canCover && <Link href="/timetable?tab=substitutes" aria-label="Needs cover, open substitutes" className="rounded-[20px] hover:bg-card-hover"><StatCard label="Needs cover" value={today ? uncoveredCount(today) : 0} /></Link>}
        {isClassTeacher && <Link href="/leave" aria-label="Pending leave requests, open" className="rounded-[20px] hover:bg-card-hover"><StatCard label="Leave" value={pendingLeaves} /></Link>}
      </div>

      {myClasses.length > 0 && (
        <Card>
          <CardHeader><CardTitle>My classes</CardTitle></CardHeader>
          <ul className="flex flex-col">
            {myClasses.map((c) => (
              <li key={c.classId} className="flex items-center justify-between gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
                <div>
                  <p className="font-medium">Class {className(c.classId)}</p>
                  <p className="text-[13px] text-muted-foreground">{STUDENTS.filter((s) => s.classId === c.classId).length} students</p>
                </div>
                <Badge tone={c.role === "class_teacher" ? "brand" : "neutral"}>{c.role === "class_teacher" ? "Class teacher" : "Subject"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
