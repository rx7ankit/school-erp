"use client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ARCHIVED_CLASSES } from "@/lib/mock";

/** Read-only archive of a completed year: the classes as they were, with the students they had. */
export function ArchivedClasses() {
  const labels = [...new Set(ARCHIVED_CLASSES.map((c) => c.yearLabel))];
  if (!labels.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {labels.map((label) => (
        <section key={label} aria-label={`Completed ${label}`} className="flex flex-col gap-3">
          <div className="flex items-center gap-3"><h2 className="text-[19px] font-bold tracking-tight">Completed {label}</h2><Badge>Read-only</Badge></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ARCHIVED_CLASSES.filter((c) => c.yearLabel === label).map((c) => (
              <Card key={c.id} className="p-5">
                <p className="text-xl font-bold leading-none tracking-tight">{c.grade}-{c.section}</p>
                <p className="mt-1.5 text-[13px] tabular-nums text-muted-foreground">{c.students} {c.students === 1 ? "student" : "students"}</p>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
