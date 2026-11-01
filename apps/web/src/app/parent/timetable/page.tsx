"use client";
import { PageHeader } from "@/components/app/page-header";
import { TimetableGrid } from "@/components/app/timetable/timetable-grid";
import { useChild } from "@/components/parent-child";
import { className } from "@/lib/mock";
import { useTimetable } from "@/lib/timetable";
import { useTodayIST } from "@/lib/use-today";

export default function ParentTimetable() {
  const sel = useChild();
  const today = useTodayIST();
  useTimetable();
  if (!sel || !today) return null;
  return (
    <>
      <PageHeader eyebrow={`${sel.child.name} · Class ${className(sel.child.classId)}`} title="Timetable." dim="The week at a glance." />
      <TimetableGrid classId={sel.child.classId} todayOn={today} />
      <p className="text-xs text-text-tertiary">Times are school times (IST). Swipe sideways on a phone to see every day.</p>
    </>
  );
}
