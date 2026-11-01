"use client";
import { ArrowRight } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { customClassNames, STANDARD_GRADES } from "@/lib/academic-setup";
import type { ClassRow } from "@/lib/mock";
import type { Dest } from "@/lib/rollover";

const SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const PASSED = "__passed_out";

/** "8-A becomes 9-A". The destination can be another grade or section, or "Completes school". */
export function DestPicker({ cls, dest, onChange }: { cls: ClassRow; dest: Dest; onChange: (d: Dest) => void }) {
  const grades = [...STANDARD_GRADES, ...customClassNames().filter((g) => !STANDARD_GRADES.includes(g))];
  const sections = dest && !SECTIONS.includes(dest.section) ? [...SECTIONS, dest.section] : SECTIONS;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-bold">{cls.grade}-{cls.section}</span>
      <ArrowRight className="size-4 text-text-tertiary" aria-hidden />
      <NativeSelect aria-label={`Next year's class for ${cls.grade}-${cls.section}`} className="w-48"
        value={dest ? dest.grade : PASSED}
        onChange={(e) => onChange(e.target.value === PASSED ? null : { grade: e.target.value, section: dest?.section ?? cls.section })}>
        {grades.map((g) => <option key={g} value={g}>Class {g}</option>)}
        <option value={PASSED}>Completes school</option>
      </NativeSelect>
      {dest && (
        <NativeSelect aria-label={`Next year's section for ${cls.grade}-${cls.section}`} className="w-24" value={dest.section} onChange={(e) => onChange({ grade: dest.grade, section: e.target.value })}>
          {sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </NativeSelect>
      )}
    </div>
  );
}
