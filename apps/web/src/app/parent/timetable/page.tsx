"use client";
import { PageHeader } from "@/components/app/page-header";
import { TimetableGrid } from "@/components/app/timetable/timetable-grid";
import { useChild } from "@/components/parent-child";
import { className } from "@/lib/mock";
import { useT } from "@/lib/parent-i18n";
import { useTimetable } from "@/lib/timetable";
import { useTodayIST } from "@/lib/use-today";

export default function ParentTimetable() {
  const t = useT();
  const sel = useChild();
  const today = useTodayIST();
  useTimetable();
  if (!sel || !today) return null;
  return (
    <>
      <PageHeader eyebrow={`${sel.child.name} · ${t("hdr.class", { c: className(sel.child.classId) })}`} title={t("tt.title")} dim={t("tt.dim")} />
      <TimetableGrid classId={sel.child.classId} todayOn={today} />
      <p className="text-xs text-text-tertiary">{t("tt.note")}</p>
    </>
  );
}
