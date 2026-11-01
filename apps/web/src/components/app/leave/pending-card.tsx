"use client";
import * as React from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LeaveStatusBadge, rangeLabel } from "./leave-bits";
import { decide, type LeaveRequest } from "@/lib/leave";
import { className, STUDENTS } from "@/lib/mock";
import { formatIST } from "@/lib/time";
import { usePending } from "@/lib/use-pending";

/** One pending request for the class teacher, with Approve and Reject. */
export function PendingLeaveCard({ leave, by }: { leave: LeaveRequest; by: string }) {
  const s = STUDENTS.find((x) => x.id === leave.studentId);
  const [note, setNote] = React.useState("");
  const { run, is } = usePending();
  if (!s) return null;
  const act = (action: "approve" | "reject") => run(action, () => {
    if (decide(leave.id, action, note, by)) toast.success(action === "approve" ? `Leave approved for ${s.name}` : `Leave rejected for ${s.name}`, { description: "The parent has been notified." });
  });
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={s.name} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{s.name} <span className="font-normal text-text-tertiary">· Class {className(s.classId)}</span></p>
          <p className="text-sm text-muted-foreground">{rangeLabel(leave)}</p>
        </div>
        <LeaveStatusBadge status={leave.status} />
      </div>
      <p className="text-sm">{leave.reason}</p>
      <p className="text-xs text-text-tertiary">Applied {formatIST(leave.createdAt)} IST by {s.guardian}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={`Note to ${s.guardian} (optional)`} placeholder="Note to parent (optional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="min-w-48 flex-1" />
        <Button variant="secondary" loading={is("reject")} disabled={is("approve")} onClick={() => act("reject")}>{!is("reject") && <X />}Reject</Button>
        <Button variant="brand" loading={is("approve")} disabled={is("reject")} onClick={() => act("approve")}>{!is("approve") && <Check />}Approve</Button>
      </div>
    </Card>
  );
}
