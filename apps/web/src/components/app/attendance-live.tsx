"use client";
import * as React from "react";
import { School } from "lucide-react";
import { ErrorBlock, NeedsYear, classLabel, noCurrentYear } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { AttendanceSheet } from "@/components/app/attendance-live-sheet";
import { ClassStatsTab } from "@/components/app/attendance-live-stats";
import { BelowTab, HolidaysTab, OverviewTab, StaffAttendanceTab } from "@/components/app/attendance-live-more";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClasses } from "@/lib/api/hooks/academic";
import { hasAccess } from "@/lib/permissions";
import { useTodayIST } from "@/lib/use-today";

/**
 * Attendance on the real API. The class teacher (and the admin) marks; teachers of other classes read.
 * The server decides who can do what, the screen follows `can_mark` from the sheet.
 */
export function AttendanceLive() {
  const { user } = useSession();
  const today = useTodayIST();
  const classes = useClasses();
  const seeAll = !!user && (user.isAdmin || user.permissions.includes("academic.manage") || user.permissions.includes("fees.manage"));
  const mineIds = React.useMemo(() => new Set((user?.classes ?? []).map((c) => c.classId)), [user]);
  const visible = React.useMemo(() => (classes.data?.items ?? []).filter((c) => seeAll || mineIds.has(c.id)), [classes.data, seeAll, mineIds]);
  const firstOwn = visible.find((c) => (user?.classes ?? []).some((a) => a.classId === c.id && a.role === "class_teacher")) ?? visible[0];
  const [picked, setPicked] = React.useState("");
  const [tab, setTab] = React.useState("mark");
  const [dayPicked, setDay] = React.useState("");
  const classId = visible.some((c) => c.id === picked) ? picked : firstOwn?.id ?? "";
  const cls = visible.find((c) => c.id === classId);
  const day = dayPicked || today;
  const canHoliday = hasAccess(user, "academic.manage");
  const canStaff = hasAccess(user, "staff.manage");
  const isMine = (user?.classes ?? []).some((a) => a.classId === classId && a.role === "class_teacher");

  if (!today) return null;
  const picker = visible.length > 1 ? (
    <NativeSelect aria-label="Class" className="w-40" value={classId} onChange={(e) => { setPicked(e.target.value); setDay(""); }}>
      {visible.map((c) => <option key={c.id} value={c.id}>Class {classLabel(c)}</option>)}
    </NativeSelect>
  ) : cls ? <Badge tone="brand">Class {classLabel(cls)}</Badge> : null;
  const classTabs = !!cls;

  return (
    <>
      <PageHeader title="Attendance." actions={picker} />
      {classes.isPending ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-[38px] w-80 max-w-full rounded-full" />
          <Skeleton className="h-10 w-44" />
          <Card><ul aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <li key={i} className="flex items-center gap-3 border-t border-border py-3 first:border-t-0"><Skeleton className="size-10 shrink-0 rounded-full" /><Skeleton className="h-4 w-1/3" /><Skeleton className="ml-auto h-9 w-64 max-w-[50%] rounded-full" /></li>)}</ul></Card>
        </div>
      ) : classes.isError ? (noCurrentYear(classes.error) ? <NeedsYear /> : <ErrorBlock error={classes.error} onRetry={() => classes.refetch()} />) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {classTabs && <><TabsTrigger value="mark">{isMine || user?.isAdmin ? "Mark" : "Day"}</TabsTrigger><TabsTrigger value="stats">Stats</TabsTrigger></>}
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="below">Below</TabsTrigger>
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
            {canStaff && <TabsTrigger value="staff">Staff</TabsTrigger>}
          </TabsList>
          {classTabs ? (
            <>
              <TabsContent value="mark"><AttendanceSheet classId={classId} day={day} setDay={setDay} today={today} /></TabsContent>
              <TabsContent value="stats"><ClassStatsTab classId={classId} today={today} /></TabsContent>
            </>
          ) : (tab === "mark" || tab === "stats") && <EmptyState icon={School} title="No class" />}
          <TabsContent value="overview"><OverviewTab today={today} classId={classId || undefined} /></TabsContent>
          <TabsContent value="below"><BelowTab today={today} classId={classId || undefined} /></TabsContent>
          <TabsContent value="holidays"><HolidaysTab canEdit={canHoliday} /></TabsContent>
          {canStaff && <TabsContent value="staff"><StaffAttendanceTab today={today} /></TabsContent>}
        </Tabs>
      )}
    </>
  );
}
