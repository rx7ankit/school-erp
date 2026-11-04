"use client";
import * as React from "react";
import { CalendarClock } from "lucide-react";
import { ErrorBlock } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { DayEntries, SkDayEntries, SkWeekGrid, WeekGrid, weekdayOf } from "@/components/app/timetable-live-bits";
import { CoverTab } from "@/components/app/timetable-live-cover";
import { ClassTimetableTab, PeriodsTab } from "@/components/app/timetable-live-edit";
import { useSession } from "@/components/session-provider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Appear } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCover, useMyDay, useMyTimetable, useStaffTimetable, useTeacherOptions } from "@/lib/api/hooks/timetable";
import { hasAccess } from "@/lib/permissions";
import { formatDateOn } from "@/lib/time";
import { useNowIST } from "@/lib/timetable";
import { useTodayIST } from "@/lib/use-today";

const noSubscribe = () => () => {};

function MyDay({ today }: { today: string }) {
  const [day, setDay] = React.useState(today);
  const q = useMyDay(day);
  const now = useNowIST();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Day" type="date" className="w-44" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <span className="text-sm text-muted-foreground">{formatDateOn(day, "weekday")}</span>
      </div>
      {q.isPending ? <Card role="status" aria-busy="true"><span className="sr-only">Loading</span><SkDayEntries /></Card> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : q.data.entries.length === 0 ? (
        <EmptyState icon={CalendarClock} title={weekdayOf(day) === 0 ? "Sunday" : "No periods"} />
      ) : <Appear><Card><DayEntries entries={q.data.entries} nowHm={day === today ? now : ""} /></Card></Appear>}
    </div>
  );
}

/** A teacher's week. Managers can pick any teacher, everyone else sees their own. */
function TeacherWeek({ canPick, canListStaff, todayWd }: { canPick: boolean; canListStaff: boolean; todayWd: number }) {
  const { me } = useSession();
  const teachers = useTeacherOptions(canListStaff);
  const [picked, setPicked] = React.useState("");
  const other = canPick && picked && picked !== me?.id ? picked : "";
  const mine = useMyTimetable();
  const theirs = useStaffTimetable(other);
  const q = other ? theirs : mine;
  return (
    <div className="flex flex-col gap-4">
      {canPick && (
        <NativeSelect aria-label="Teacher" className="w-64" value={picked || me?.id || ""} onChange={(e) => setPicked(e.target.value)}>
          {me && !teachers.data.some((t) => t.id === me.id) && <option value={me.id}>{me.name} (you)</option>}
          {teachers.data.map((t) => <option key={t.id} value={t.id}>{t.name}{t.id === me?.id ? " (you)" : ""}</option>)}
        </NativeSelect>
      )}
      {q.isPending ? <SkWeekGrid /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : q.data.slots.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No periods" />
      ) : <Appear><WeekGrid periods={q.data.periods} slots={q.data.slots} show={(s) => `Class ${s.class_label}`} todayWd={todayWd} /></Appear>}
    </div>
  );
}

/** Timetable on the real API: My day, my week, class timetables, periods, and cover. */
export function TimetableLive() {
  const { user } = useSession();
  const today = useTodayIST();
  const canCover = hasAccess(user, "staff.manage");
  const canEdit = hasAccess(user, "academic.manage");
  const wanted = React.useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).get("tab") ?? "", () => "");
  const [picked, setTab] = React.useState<string | null>(null);
  const tab = picked ?? (wanted === "substitutes" && canCover ? "substitutes" : "day");
  const cover = useCover(today, canCover);
  if (!user || !today) return null;
  const open = (cover.data ?? []).filter((r) => !r.substitution_id).length;
  const wd = weekdayOf(today);
  return (
    <>
      <PageHeader title="Timetable." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="day">Today</TabsTrigger>
          <TabsTrigger value="week">{canEdit || canCover ? "Teachers" : "Week"}</TabsTrigger>
          <TabsTrigger value="class">Class</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          {canCover && <TabsTrigger value="substitutes">Cover{open > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[11px] text-white">{open}</span>}</TabsTrigger>}
        </TabsList>
        <TabsContent value="day"><MyDay today={today} /></TabsContent>
        <TabsContent value="week"><TeacherWeek canPick={canEdit || canCover} canListStaff={canCover} todayWd={wd} /></TabsContent>
        <TabsContent value="class"><ClassTimetableTab canEdit={canEdit} canListStaff={canCover} todayWd={wd} defaultClassId={user.classes[0]?.classId} /></TabsContent>
        <TabsContent value="periods"><PeriodsTab canEdit={canEdit} /></TabsContent>
        {canCover && <TabsContent value="substitutes"><CoverTab today={today} /></TabsContent>}
      </Tabs>
    </>
  );
}
