"use client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
        <CardHeader><CardTitle>Timetable</CardTitle></CardHeader>
        <ChoiceGroup label="Timetable" value={draft.timetable} onChange={(v) => update((d) => ({ ...d, timetable: v }))} options={[
          { value: "copy", title: "Copy last year" },
          { value: "empty", title: "Start empty" },
        ]} />
      </Card>
    </div>
  );
}
