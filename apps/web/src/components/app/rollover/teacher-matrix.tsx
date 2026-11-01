"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { staffHint } from "@/lib/assignments";
import { STAFF } from "@/lib/mock";
import { keyLabel, slotCounts, subjectsOf, teacherChoice, teacherSource, type PlanClass } from "@/lib/rollover";
import type { TeacherMode } from "@/lib/rollover";
import { ChoiceGroup } from "./choice-card";
import type { StepProps } from "./step-props";

const MODES: { value: TeacherMode; title: string; text: string }[] = [
  { value: "same", title: "Same teachers for the same class", text: "9-A keeps the teachers 9-A has now. The easiest start." },
  { value: "move_up", title: "Move teachers up with their class", text: "The teachers of 8-A go to 9-A, together with their students." },
  { value: "empty", title: "Start empty", text: "Pick every teacher yourself." },
];

function Pick({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) {
  return (
    <NativeSelect aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1">
      <option value="">Not assigned</option>
      {STAFF.map((s) => <option key={s.id} value={s.id}>{s.name} ({staffHint(s)})</option>)}
    </NativeSelect>
  );
}

function ClassCard({ c, props }: { c: PlanClass; props: StepProps }) {
  const { draft, update } = props;
  const ch = teacherChoice(draft, c);
  const names = subjectsOf(draft, c.key);
  const label = keyLabel(c.key);
  const open = (ch.ct ? 0 : 1) + names.filter((n) => !ch.subjects[n]).length;
  const from = teacherSource(draft, c);
  const setCt = (id: string) => update((d) => ({ ...d, teachers: { ...d.teachers, [c.key]: { ...d.teachers[c.key], ct: id || null } } }));
  const setSub = (n: string, id: string) => update((d) => ({ ...d, teachers: { ...d.teachers, [c.key]: { ...d.teachers[c.key], subjects: { ...d.teachers[c.key]?.subjects, [n]: id || null } } } }));
  return (
    <section aria-label={`Teachers for class ${label}`} className="flex flex-col gap-4 rounded-[20px] bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h4 className="text-[17px] font-bold">Class {label}</h4><p className="text-xs text-muted-foreground">{c.total} students{from ? "" : ", teachers start empty"}</p></div>
        {open ? <Badge tone="warning">{open} to assign</Badge> : <Badge tone="success">Complete</Badge>}
      </div>
      <div className="grid gap-1.5">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Class teacher</p>
        <Pick label={`Class teacher of ${label}`} value={ch.ct ?? ""} onChange={setCt} />
      </div>
      {names.length === 0 ? <p className="rounded-xl bg-fill px-4 py-3 text-sm text-muted-foreground">No subjects ticked for this class.</p> : (
        <ul className="flex flex-col gap-3">
          {names.map((n) => (
            <li key={n} className="grid items-center gap-1.5 sm:grid-cols-[7rem_1fr] sm:gap-3">
              <span className="text-sm font-medium">{n}</span>
              <Pick label={`${n} teacher for ${label}`} value={ch.subjects[n] ?? ""} onChange={(id) => setSub(n, id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Teacher starting point plus the same class-teacher and subject-teacher matrix the Academic setup uses. */
export function TeacherMatrix(props: StepProps) {
  const { draft, plan, update } = props;
  const { filled, total } = slotCounts(draft, plan);
  return (
    <Card>
      <CardHeader>
        <div><CardTitle>Teachers</CardTitle><CardDescription>Pick a starting point, then change what you need. Finishing later is fine: empty slots stay on your checklist.</CardDescription></div>
        <Badge tone={filled === total ? "success" : "warning"}>{filled} of {total} slots filled</Badge>
      </CardHeader>
      <ChoiceGroup label="Teachers starting point" value={draft.teacherMode} onChange={(v) => update((d) => ({ ...d, teacherMode: v, teachers: {} }))} options={MODES} className="mb-5" />
      <div className="grid gap-4 md:grid-cols-2">{plan.classes.map((c) => <ClassCard key={c.key} c={c} props={props} />)}</div>
    </Card>
  );
}
