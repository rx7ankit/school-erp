"use client";
import { useAcademic } from "@/lib/academic-setup";

/** Small one-line legend of the grading scheme, for parents and teachers. */
export function GradeLegend({ className }: { className?: string }) {
  const { scheme } = useAcademic();
  const items = [...scheme.bands.map((b, i) => `${b.grade} ${b.min}${i === 0 ? "+" : "-" + (scheme.bands[i - 1].min - 1)}`), `${scheme.floorGrade} below ${scheme.bands.at(-1)?.min ?? 0}`];
  return (
    <p className={className ?? "text-xs text-text-tertiary"}>
      <span className="font-medium">Grades (percent): </span>{items.join(" · ")}. Pass is {scheme.passPercent}% overall.
    </p>
  );
}
