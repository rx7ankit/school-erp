"use client";
import * as React from "react";
import { Plus, X } from "lucide-react";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { customClassNames, STANDARD_GRADES } from "@/lib/academic-setup";
import { keyLabel, keyOf } from "@/lib/rollover";
import type { StepProps } from "./step-props";

const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function StepYear({ draft, plan, update }: StepProps) {
  const [grade, setGrade] = React.useState("9");
  const [section, setSection] = React.useState("C");
  const grades = [...STANDARD_GRADES, ...customClassNames().filter((g) => !STANDARD_GRADES.includes(g))];
  const exists = plan.byKey.has(keyOf(grade, section));
  const yearOk = /^\d{4}-\d{2}$/.test(draft.year.label);
  const setYear = (patch: Partial<typeof draft.year>) => update((d) => ({ ...d, year: { ...d.year, ...patch } }));
  function add() {
    const key = keyOf(grade, section);
    update((d) => ({ ...d, extraClasses: [...new Set([...d.extraClasses, key])], removedClasses: d.removedClasses.filter((k) => k !== key) }));
  }
  function remove(key: string) {
    update((d) => ({ ...d, extraClasses: d.extraClasses.filter((k) => k !== key), removedClasses: [...new Set([...d.removedClasses, key])] }));
  }
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><div><CardTitle>The new year</CardTitle><CardDescription>Suggested from this year. Change the dates if your session starts on another day.</CardDescription></div></CardHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Year name" htmlFor="ro-year" hint={yearOk ? undefined : "Write it as 2027-28."}>
            <Input id="ro-year" value={draft.year.label} aria-invalid={!yearOk || undefined} onChange={(e) => setYear({ label: e.target.value })} />
          </Field>
          <Field label="Starts on" htmlFor="ro-from"><Input id="ro-from" type="date" value={draft.year.fromOn} onChange={(e) => setYear({ fromOn: e.target.value })} /></Field>
          <Field label="Ends on" htmlFor="ro-to" hint={draft.year.toOn <= draft.year.fromOn ? "The end must be after the start." : undefined}>
            <Input id="ro-to" type="date" value={draft.year.toOn} aria-invalid={draft.year.toOn <= draft.year.fromOn || undefined} onChange={(e) => setYear({ toOn: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Classes in {draft.year.label}</CardTitle><CardDescription>Worked out from the Students step. Seats are copied from this year.</CardDescription></div><Badge tone="brand">{plan.classes.length} classes</Badge></CardHeader>
        <ul className="flex flex-col gap-2">
          {plan.classes.map((c) => (
            <li key={c.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-fill px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Class {keyLabel(c.key)} {c.fresh && <Badge className="ml-1">Empty, for new admissions</Badge>}{c.extra && <Badge className="ml-1" tone="brand">Added</Badge>}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {c.total ? `${c.total} students${c.promoted && c.stayed ? ` (${c.promoted} moving up, ${c.stayed} staying)` : c.stayed ? " (staying)" : " (moving up)"}` : "No students yet"}
                </p>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                Seats
                <Input aria-label={`Seats in class ${keyLabel(c.key)}`} inputMode="numeric" className="h-9 w-20 bg-card text-right tabular-nums" aria-invalid={c.total > c.capacity || undefined}
                  value={String(c.capacity)} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); update((d) => ({ ...d, capacity: { ...d.capacity, [c.key]: n } })); }} />
              </label>
              <Button size="icon-sm" variant="ghost" aria-label={`Remove class ${keyLabel(c.key)}`} disabled={c.total > 0} title={c.total > 0 ? "Classes with students cannot be removed" : "Remove this empty class"} onClick={() => remove(c.key)}><X /></Button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-5">
          <Field label="Add a section" htmlFor="ro-add-grade"><NativeSelect id="ro-add-grade" className="w-36" value={grade} onChange={(e) => setGrade(e.target.value)}>{grades.map((g) => <option key={g} value={g}>Class {g}</option>)}</NativeSelect></Field>
          <Field label="Section" htmlFor="ro-add-sec"><NativeSelect id="ro-add-sec" className="w-24" value={section} onChange={(e) => setSection(e.target.value)}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
          <Button variant="secondary" disabled={exists} onClick={add}><Plus /> Add {grade}-{section}</Button>
          {exists && <p className="pb-2.5 text-xs text-text-tertiary">{grade}-{section} is already in the list.</p>}
        </div>
      </Card>
    </div>
  );
}
