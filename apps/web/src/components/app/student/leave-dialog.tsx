"use client";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Student } from "@/lib/mock";
import { issueCertificate, markLeft } from "@/lib/student-record";
import { usePending } from "@/lib/use-pending";

/** Mark a student as left, optionally issuing the transfer certificate in the same step. */
export function LeaveDialog({ student, open, onOpenChange, today, by }: {
  student: Student; open: boolean; onOpenChange: (o: boolean) => void; today: string; by: string;
}) {
  const { run, is } = usePending();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const on = String(f.get("on")), reason = String(f.get("reason")), wantTc = f.get("tc") === "on";
    run("left", () => {
      markLeft(student, { on, reason });
      if (wantTc) issueCertificate({ ...student, status: "left", leftOn: on, leavingReason: reason }, { kind: "transfer", reason, issuedBy: by });
      onOpenChange(false);
      toast.success(`${student.name} marked as left`);
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Mark {student.name} as left</DialogTitle>
          <DialogDescription>Attendance and new fee invoices stop. Past records, results and receipts stay. The parent keeps read-only access.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Last day at school" htmlFor="on"><Input id="on" name="on" type="date" defaultValue={today} required /></Field>
          <Field label="Reason" htmlFor="reason"><Input id="reason" name="reason" placeholder="Family moved, changed school, ..." required /></Field>
          <div className="flex items-center gap-3"><Checkbox id="tc" name="tc" /><Label htmlFor="tc">Issue a transfer certificate</Label></div>
          <DialogFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="destructive" loading={is("left")}>Mark as left</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
