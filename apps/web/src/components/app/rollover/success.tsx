"use client";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { ExportButton } from "@/components/app/export-button";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useAssignments } from "@/lib/assignments";
import { useFeesStore } from "@/lib/fees-setup";
import { checklistRows, markChecklistDone, useChecklistVersion, type RolloverResult } from "@/lib/rollover";
import { type Sheet } from "@/lib/export";
import { formatINR } from "@/lib/time";
import { PageHeader } from "@/components/app/page-header";
import { CLASSES, STUDENTS, className } from "@/lib/mock";
import { cn } from "@/lib/utils";

function sheets(r: RolloverResult): Sheet[] {
  const lists = CLASSES.flatMap((c) => STUDENTS.filter((s) => s.classId === c.id && s.status === "active").sort((a, b) => a.rollNo - b.rollNo).map((s) => [className(c.id), s.rollNo, s.name, s.scholarNo, s.guardian, s.phone] as (string | number)[]));
  return [
    { name: "Promotion list", headers: ["Scholar no", "Student", "Class in " + r.fromLabel, "Outcome", "Class in " + r.toLabel, "Roll no", "Guardian", "Phone"], rows: r.rows.map((x) => [x.scholarNo, x.name, x.from, x.outcome, x.to, x.roll, x.guardian, x.phone]) },
    { name: "New class lists", headers: ["Class", "Roll no", "Student", "Scholar no", "Guardian", "Phone"], rows: lists },
  ];
}

/** After Apply: what happened, and what is left, with a link for each. */
export function SuccessScreen({ result }: { result: RolloverResult }) {
  useChecklistVersion(); useAssignments(); useFeesStore();
  const rows = checklistRows(result);
  const left = rows.filter((x) => !x.done).length;
  return (
    <>
      <PageHeader title={result.toLabel.replace("–", "\u2060–\u2060").replace("-", "\u2060-\u2060")} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Moved up" value={result.promoted} hint={result.stayed ? `${result.stayed} stayed` : undefined} />
        <StatCard label="Passed out" value={result.passedOut} hint={result.leaving ? `${result.leaving} left` : undefined} />
        <StatCard label="New classes" value={result.newClasses} hint={`${result.slotsFilled}/${result.slotsTotal} teacher slots`} />
        <StatCard label="Parents notified" value={result.notified} hint={result.duesWrittenOffPaise ? `${formatINR(result.duesWrittenOffPaise)} written off` : result.duesCarriedPaise ? `${formatINR(result.duesCarriedPaise)} carried` : undefined} />
      </div>
      <Card>
        <CardHeader><CardTitle>{left ? `${left} left` : "All done"}</CardTitle></CardHeader>
        <ul className="flex flex-col">
          {rows.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border py-3.5 first:border-t-0 first:pt-0">
              {x.done ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" /> : <Circle className="size-5 shrink-0 text-text-tertiary" aria-label="To do" />}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", x.done && "text-muted-foreground line-through decoration-1")}>{x.text}</p>
              </div>
              {x.id === "downloads" ? (
                !x.done && <ExportButton size="sm" fileName={`promotion-${result.toLabel}`} label="Excel" build={() => sheets(result)} onDone={() => markChecklistDone("downloads")} />
              ) : (
                <div className="flex items-center gap-2">
                  {!x.done && <Button asChild size="sm" variant="secondary"><Link href={x.href}>Open</Link></Button>}
                  {!x.done && x.manual && <Button size="sm" variant="ghost" onClick={() => markChecklistDone(x.id)}>Mark done</Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex flex-wrap gap-2.5">
        <Button asChild variant="brand"><Link href="/dashboard">Dashboard</Link></Button>
        <Button asChild variant="secondary"><Link href="/classes">Classes</Link></Button>
        <Button asChild variant="ghost"><Link href="/students">Students</Link></Button>
      </div>
    </>
  );
}
