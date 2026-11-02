"use client";
import * as React from "react";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { errorText } from "@/lib/api/hooks/academic";
import type { ClassOut } from "@/lib/api/types";

export const STANDARD_GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
export const classLabel = (c: Pick<ClassOut, "grade" | "section">) => `${c.grade}-${c.section}`;
export const noCurrentYear = (e: unknown) => e instanceof ApiError && e.code === "no_current_year";

/** Classes grouped by grade, in the order the API sorted them. */
export function groupByGrade(classes: ClassOut[]) {
  const m = new Map<string, ClassOut[]>();
  for (const c of classes) m.set(c.grade, [...(m.get(c.grade) ?? []), c]);
  return [...m.entries()].map(([grade, sections]) => ({ grade, title: sections[0].is_custom ? grade : `Class ${grade}`, sections }));
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return (
    <Card className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground" role="status" aria-live="polite">
      <Spinner /> {label}
    </Card>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-[20px] bg-card px-6 py-12 text-center">
      <h3 className="text-[17px] font-bold">Could not load</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{errorText(error)}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function NeedsYear() {
  return <EmptyState icon={Layers} title="No current year" />;
}
