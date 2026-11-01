"use client";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { StatCard } from "@/components/app/stat-card";
import { validateDraft, type RolloverPreview } from "@/lib/rollover";
import { formatDateOn, formatINR } from "@/lib/time";
import type { StepProps } from "./step-props";

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return <li className="flex items-baseline justify-between gap-4 border-t border-border py-2.5 text-sm first:border-t-0 first:pt-0"><span className="text-muted-foreground">{label}</span><b className="text-right tabular-nums">{value}</b></li>;
}

/** The plain list of what Apply will do. Every number comes from the same plan Apply uses. */
export function whatWillHappen(p: RolloverPreview, from: string, to: string, dues: "carry" | "writeoff", timetable: "copy" | "empty"): string[] {
  const out = [
    `${from} is marked completed and becomes read-only. ${to} becomes the current year.`,
    `${p.newClasses} classes are created for ${to}. Last year's classes stay as the archive.`,
    `${p.promoted} students move up${p.stayed ? `, ${p.stayed} stay in their class` : ""}${p.passedOut ? `, ${p.passedOut} complete school` : ""}${p.leaving ? ` and ${p.leaving} are marked as left` : ""}. Each one gets a history entry.`,
    `Subjects and ${p.slotsFilled} of ${p.slotsTotal} teacher slots are set. ${timetable === "copy" ? "The timetable is copied from last year." : "The timetable starts empty."}`,
    `Fees are set for every class.${p.duesMovingPaise ? (dues === "carry" ? ` ${formatINR(p.duesMovingPaise)} of unpaid fees is carried forward for students who continue.` : ` ${formatINR(p.duesMovingPaise)} of unpaid fees is written off for students who continue.`) : ""}${p.duesStayingPaise ? ` ${formatINR(p.duesStayingPaise)} owed by students who are leaving or completing school stays on their old invoices to collect.` : ""}`,
  ];
  if (p.invoicesNow) out.push(`First invoices are created for ${p.invoiceStudents} students.`);
  out.push(`${p.parentsNotified} parents get a message about where their child is now.`);
  return out;
}

export function StepReview({ draft, plan, update, preview, applying, onApply }: StepProps & { preview: RolloverPreview; applying: boolean; onApply: () => void }) {
  const p = preview;
  const problem = validateDraft({ ...draft, ack: true });
  const blocked = !!problem;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Moving up" value={p.promoted} />
        <StatCard label="Staying" value={p.stayed} />
        <StatCard label="Leaving" value={p.leaving} />
        <StatCard label="Passing out" value={p.passedOut} />
      </div>
      <Card>
        <CardHeader><div><CardTitle>{draft.fromLabel} to {draft.year.label}</CardTitle><CardDescription>{formatDateOn(draft.year.fromOn)} to {formatDateOn(draft.year.toOn)}</CardDescription></div></CardHeader>
        <ul>
          <Line label="New classes" value={`${p.newClasses}${p.freshClasses ? ` (${p.freshClasses} empty for admissions)` : ""}`} />
          <Line label="Subjects" value={`${p.subjectTicks} across classes${p.newSubjects ? `, ${p.newSubjects} new` : ""}`} />
          <Line label="Teacher slots filled" value={`${p.slotsFilled} of ${p.slotsTotal}`} />
          <Line label="Unpaid fees, continuing students" value={p.duesMovingPaise ? `${formatINR(p.duesMovingPaise)} (${p.duesMovingStudents} students), ${draft.fees.dues === "carry" ? "carried forward" : "written off"}` : "None"} />
          {p.duesStayingPaise > 0 && <Line label="Unpaid fees, leaving or completing" value={`${formatINR(p.duesStayingPaise)}, stays to collect`} />}
          <Line label="First invoices" value={p.invoicesNow ? `${p.invoiceStudents} students, ${draft.fees.period}` : "Later"} />
          <Line label="Parents who will get a notification" value={p.parentsNotified} />
        </ul>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>Fees by class</CardTitle><CardDescription>Per student for the year, from the grid in the Fees step.</CardDescription></div></CardHeader>
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {p.feeByClass.map((c) => <Line key={c.key} label={`Class ${c.label} (${c.students} students)`} value={formatINR(c.perStudentPaise)} />)}
        </ul>
      </Card>
      <Card>
        <CardHeader><div><CardTitle>What will happen</CardTitle><CardDescription>Everything below happens together. If something fails, nothing changes.</CardDescription></div></CardHeader>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">{whatWillHappen(p, draft.fromLabel, draft.year.label, draft.fees.dues, draft.timetable).map((t) => <li key={t}>{t}</li>)}</ol>
        {p.warnings.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {p.warnings.map((w) => <li key={w} className="flex items-start gap-3 rounded-xl bg-fill px-4 py-3 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />{w}</li>)}
          </ul>
        )}
      </Card>
      <Card className="flex flex-col gap-4">
        <label htmlFor="ro-ack" className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox id="ro-ack" className="mt-0.5" checked={draft.ack} onCheckedChange={(v) => update((d) => ({ ...d, ack: v === true }))} />
          <span><b>I have checked this.</b> After Apply, {draft.fromLabel} cannot be reopened. To fix one student later, use the student profile.</span>
        </label>
        {problem && <p role="alert" className="flex items-start gap-2 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{problem}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand" size="lg" loading={applying} disabled={!draft.ack || blocked} onClick={onApply}>Apply rollover</Button>
          <span className="text-xs text-text-tertiary">{plan.classes.length} classes, {p.total} students</span>
        </div>
      </Card>
    </div>
  );
}
