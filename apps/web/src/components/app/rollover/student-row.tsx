"use client";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { Student } from "@/lib/mock";
import type { Decision } from "@/lib/rollover";
import { formatINR } from "@/lib/time";
import { DecisionToggle } from "./decision-toggle";

export interface Hints { resultPct: number; attendancePct: number; balancePaise: number; belowPass: boolean; }

/** One student: tick box for the bulk actions, hints that make the decision easy, the three-way choice. */
export function StudentRow({ student, hints, decision, selected, promoteLabel, onSelect, onDecide }: {
  student: Student; hints: Hints; decision: Decision; selected: boolean; promoteLabel: string;
  onSelect: (on: boolean) => void; onDecide: (d: Decision) => void;
}) {
  return (
    <li className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Checkbox aria-label={`Select ${student.name}`} checked={selected} onCheckedChange={(v) => onSelect(v === true)} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            {student.name}
            {hints.belowPass && <Badge tone="danger">Below pass</Badge>}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
            <span>Roll {student.rollNo}</span>
            <span>Result {hints.resultPct}%</span>
            <span>Attendance {hints.attendancePct}%</span>
            <span className={hints.balancePaise > 0 ? "text-warning" : undefined}>{hints.balancePaise > 0 ? `Owes ${formatINR(hints.balancePaise)}` : "Paid"}</span>
          </p>
        </div>
      </div>
      <div className="pl-8 sm:pl-0"><DecisionToggle name={student.name} value={decision} onChange={onDecide} promoteLabel={promoteLabel} /></div>
    </li>
  );
}
