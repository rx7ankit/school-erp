"use client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceGroup } from "./choice-card";
import { SubjectGrid } from "./subject-grid";
import { TeacherMatrix } from "./teacher-matrix";
import type { StepProps } from "./step-props";

export function StepSubjects(props: StepProps) {
  const { draft, update } = props;
  return (
    <div className="flex flex-col gap-4">
      <SubjectGrid {...props} />
      <TeacherMatrix {...props} />
      <Card>
        <CardHeader><div><CardTitle>Timetable</CardTitle><CardDescription>Periods where the subject has no teacher are left empty.</CardDescription></div></CardHeader>
        <ChoiceGroup label="Timetable" value={draft.timetable} onChange={(v) => update((d) => ({ ...d, timetable: v }))} options={[
          { value: "copy", title: "Copy last year's", text: "Each new class gets the periods of the class it follows." },
          { value: "empty", title: "Start empty", text: "You build it from scratch in Timetable." },
        ]} />
      </Card>
    </div>
  );
}
