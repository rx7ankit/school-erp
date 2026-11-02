"use client";
import * as React from "react";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { useCan } from "@/components/app/can";
import { CellEditor, type CellRef } from "@/components/app/timetable/cell-editor";
import { DayList } from "@/components/app/timetable/day-list";
import { SubstitutesPanel } from "@/components/app/timetable/substitutes-panel";
import { TimetableGrid } from "@/components/app/timetable/timetable-grid";
import { useSession } from "@/components/session-provider";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CLASSES, className } from "@/lib/mock";
import { dayForTeacher, uncoveredCount, useNowIST, useTimetable, weekdayOf } from "@/lib/timetable";
import { useTodayIST } from "@/lib/use-today";
import { isLive } from "@/lib/api/config";
import { TimetableLive } from "@/components/app/timetable-live";

const noSubscribe = () => () => {};

function TimetableDemo() {
  const { user } = useSession();
  const can = useCan();
  useTimetable();
  const today = useTodayIST();
  const now = useNowIST();
  const canCover = can("staff.manage");
  const canEdit = can("academic.manage");
  // /timetable?tab=substitutes opens the cover list. Read on the client so the page stays static.
  const wanted = React.useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).get("tab") ?? "", () => "");
  const [picked, setTab] = React.useState<string | null>(null);
  const tab = picked ?? (wanted === "substitutes" && canCover ? "substitutes" : "day");
  const [classId, setClassId] = React.useState(user?.classes[0]?.classId ?? CLASSES[0].id);
  const [cell, setCell] = React.useState<CellRef | null>(null);
  if (!user || !today) return null;
  const rows = dayForTeacher(today, user.id);
  const sunday = weekdayOf(today) === 0;
  const open = uncoveredCount(today);

  return (
    <>
      <PageHeader title="Timetable." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="day">Today</TabsTrigger>
          <TabsTrigger value="class">Class</TabsTrigger>
          {canCover && <TabsTrigger value="substitutes">Cover{open > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[11px] text-white">{open}</span>}</TabsTrigger>}
        </TabsList>

        <TabsContent value="day">
          {rows.length === 0
            ? <EmptyState icon={CalendarClock} title={sunday ? "Sunday" : "No periods today"} />
            : <Card><DayList rows={rows} now={now} /></Card>}
        </TabsContent>

        <TabsContent value="class" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <NativeSelect aria-label="Class" className="w-40" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {CLASSES.map((c) => <option key={c.id} value={c.id}>Class {className(c.id)}</option>)}
            </NativeSelect>
            
          </div>
          <TimetableGrid classId={classId} todayOn={today} onEdit={canEdit ? (weekday, periodId) => setCell({ classId, weekday, periodId }) : undefined} />
          <CellEditor cell={cell} onClose={() => setCell(null)} />
        </TabsContent>

        {canCover && <TabsContent value="substitutes"><SubstitutesPanel todayOn={today} /></TabsContent>}
      </Tabs>
    </>
  );
}

export default function TimetablePage() {
  return isLive ? <TimetableLive /> : <TimetableDemo />;
}
