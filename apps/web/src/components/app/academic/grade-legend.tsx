"use client";
import { useAcademic } from "@/lib/academic-setup";
import { useTr } from "@/lib/lang-context";

/** Small one-line legend of the grading scheme, for parents and teachers. */
export function GradeLegend({ className }: { className?: string }) {
  const { scheme } = useAcademic();
  const tr = useTr();
  const items = [...scheme.bands.map((b, i) => `${b.grade} ${b.min}${i === 0 ? "+" : "-" + (scheme.bands[i - 1].min - 1)}`), tr("grade.below", "{grade} below {n}", { grade: scheme.floorGrade, n: scheme.bands.at(-1)?.min ?? 0 })];
  return (
    <p className={className ?? "text-xs text-text-tertiary"}>
      <span className="font-medium">{tr("grade.label", "Grades (percent): ")}</span>{items.join(" · ")}. {tr("grade.pass", "Pass is {p}% overall.", { p: scheme.passPercent })}
    </p>
  );
}
