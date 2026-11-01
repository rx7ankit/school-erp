"use client";
import { Badge } from "@/components/ui/badge";
import { activeStudentsIn, type SetupClass } from "@/lib/academic-setup";
import { classSlots, classTeacherOf, subjectTeacherOf } from "@/lib/assignments";
import { className } from "@/lib/mock";
import { TeacherSelect } from "./teacher-select";

export interface PendingChange { classId: string; subject: string | null; staffId: string | null; }

/** One class: class teacher on top, then one row per subject the class studies. */
export function ClassAssignCard({ cls, subjects, isBusy, onChange }: {
  cls: SetupClass; subjects: string[]; isBusy: (key: string) => boolean; onChange: (c: PendingChange) => void;
}) {
  const slots = classSlots(cls.id, subjects);
  const label = className(cls.id);
  const ct = classTeacherOf(cls.id);
  return (
    <section aria-label={`Class ${label}`} className="flex flex-col gap-4 rounded-[20px] bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h4 className="text-[17px] font-bold">Class {label}</h4><p className="text-xs text-muted-foreground">{activeStudentsIn(cls.id).length} students</p></div>
        {slots.complete
          ? <Badge tone="success">Complete</Badge>
          : <Badge tone="warning">{slots.total - slots.filled} to assign</Badge>}
      </div>
      <div className="grid gap-1.5">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Class teacher</p>
        <TeacherSelect classId={cls.id} forClassTeacher label={`Class teacher of ${label}`} value={ct?.id ?? ""} busy={isBusy(`${cls.id}|ct`)}
          onChange={(id) => onChange({ classId: cls.id, subject: null, staffId: id || null })} />
        {!ct && <p className="text-xs text-warning">Needed to mark attendance and enter results.</p>}
      </div>
      {subjects.length === 0 ? (
        <p className="rounded-xl bg-fill px-4 py-3 text-sm text-muted-foreground">No subjects yet. Tick the subjects this class studies in the Subjects tab.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {subjects.map((s) => (
            <li key={s} className="grid items-center gap-1.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
              <span className="text-sm font-medium">{s}</span>
              <TeacherSelect classId={cls.id} suggestFor={s} label={`${s} teacher for ${label}`} value={subjectTeacherOf(cls.id, s)?.id ?? ""} busy={isBusy(`${cls.id}|${s}`)}
                onChange={(id) => onChange({ classId: cls.id, subject: s, staffId: id || null })} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
