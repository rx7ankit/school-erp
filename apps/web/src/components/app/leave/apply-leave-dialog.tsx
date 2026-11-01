"use client";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyLeave, REASON_MAX, validateLeave, type LeaveHalf } from "@/lib/leave";
import { usePending } from "@/lib/use-pending";
import { cn } from "@/lib/utils";

const HALVES: { v: LeaveHalf; label: string }[] = [{ v: "none", label: "Full day" }, { v: "first", label: "First half" }, { v: "second", label: "Second half" }];

/** Parent's form to ask for leave. Validation lives in lib/leave.ts so the rules are the same everywhere. */
export function ApplyLeaveDialog({ open, onOpenChange, studentId, childName, todayOn }: {
  open: boolean; onOpenChange: (o: boolean) => void; studentId: string; childName: string; todayOn: string;
}) {
  const [fromOn, setFrom] = React.useState(todayOn);
  const [toOn, setTo] = React.useState(todayOn);
  const [half, setHalf] = React.useState<LeaveHalf>("none");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const { run, is } = usePending();
  const single = fromOn === toOn;
  const input = { studentId, fromOn, toOn, half: single ? half : "none", reason };

  function reset() { setFrom(todayOn); setTo(todayOn); setHalf("none"); setReason(""); setError(null); }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateLeave(input);
    setError(problem);
    if (problem) return;
    run("apply", () => {
      const r = applyLeave(input);
      if (!r.ok) { setError(r.error); return; }
      toast.success("Leave request sent", { description: `${childName}'s class teacher will review it.` });
      reset(); onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Apply for leave</DialogTitle><DialogDescription>For {childName}. The class teacher approves or rejects it.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" htmlFor="lv-from"><Input id="lv-from" type="date" min={todayOn} value={fromOn} onChange={(e) => { setFrom(e.target.value); if (toOn < e.target.value) setTo(e.target.value); }} required /></Field>
            <Field label="To" htmlFor="lv-to"><Input id="lv-to" type="date" min={fromOn || todayOn} value={toOn} onChange={(e) => setTo(e.target.value)} required /></Field>
          </div>
          <div className="flex flex-col gap-2">
            <span id="lv-half-l" className="text-sm font-medium">Which part of the day</span>
            <div role="radiogroup" aria-labelledby="lv-half-l" className="inline-flex gap-0.5 self-start rounded-full bg-fill p-[3px]">
              {HALVES.map((h) => {
                const on = (single ? half : "none") === h.v;
                return <button key={h.v} type="button" role="radio" aria-checked={on} disabled={!single && h.v !== "none"} onClick={() => setHalf(h.v)}
                  className={cn("h-8 rounded-full px-3 text-sm font-medium text-muted-foreground disabled:opacity-40", on && "bg-solid text-on-solid")}>{h.label}</button>;
              })}
            </div>
            {!single && <p className="text-xs text-text-tertiary">Half days are for a single date.</p>}
          </div>
          <Field label="Reason" htmlFor="lv-reason">
            <Textarea id="lv-reason" value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} placeholder="For example: fever, family function" aria-describedby="lv-count" required />
            <p id="lv-count" className="text-right text-xs tabular-nums text-text-tertiary">{reason.length}/{REASON_MAX}</p>
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="brand" loading={is("apply")}>Send request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
