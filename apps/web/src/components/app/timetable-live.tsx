"use client";
import * as React from "react";
import { CalendarClock } from "lucide-react";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { DayEntries, WeekGrid, weekdayOf } from "@/components/app/timetable-live-bits";
import { CoverTab } from "@/components/app/timetable-live-cover";
import { ClassTimetableTab, PeriodsTab } from "@/components/app/timetable-live-edit";
import { useSession } from "@/components/session-provider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : q.data.entries.length === 0 ? (
        <EmptyState icon={CalendarClock} title={weekdayOf(day) === 0 ? "No classes today" : "You have no periods this day"}
          text={weekdayOf(day) === 0 ? "It is Sunday. Your week starts on Monday." : "You do not teach any period this day. If someone asks you to cover a class, it shows up here."} />
      ) : <Card><DayEntries entries={q.data.entries} nowHm={day === today ? now : ""} /></Card>}
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
      {q.isPending ? <LoadingBlock /> : q.isError ? <ErrorBlock error={q.error} onRetry={() => q.refetch()} /> : q.data.slots.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No periods in the week" text="Periods appear here once the academic team adds this teacher to a class timetable." />
      ) : <WeekGrid periods={q.data.periods} slots={q.data.slots} show={(s) => `Class ${s.class_label}`} todayWd={todayWd} />}
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
      <PageHeader eyebrow={formatDateOn(today, "weekday")} title="Timetable." dim="Periods, classes, cover." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="day">My day</TabsTrigger>
          <TabsTrigger value="week">{canEdit || canCover ? "Teacher week" : "My week"}</TabsTrigger>
          <TabsTrigger value="class">Class timetable</TabsTrigger>
          <TabsTrigger value="periods">Periods</TabsTrigger>
          {canCover && <TabsTrigger value="substitutes">Substitutes{open > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[11px] text-white">{open}</span>}</TabsTrigger>}
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
