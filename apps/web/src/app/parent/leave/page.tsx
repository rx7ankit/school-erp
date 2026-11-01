"use client";
import * as React from "react";
import { CalendarPlus, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ApplyLeaveDialog } from "@/components/app/leave/apply-leave-dialog";
import { LeaveStatusBadge, rangeLabel } from "@/components/app/leave/leave-bits";
import { useChild } from "@/components/parent-child";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelLeave, useLeaves } from "@/lib/leave";
import { formatIST } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { useTodayIST } from "@/lib/use-today";

export default function ParentLeave() {
  const sel = useChild();
  const today = useTodayIST();
  const leaves = useLeaves();
  const [open, setOpen] = React.useState(false);
  const [cancelId, setCancelId] = React.useState<string | null>(null);
  const { run, is } = usePending();
  if (!sel || !today) return null;
  const { child } = sel;
  const left = child.status !== "active";
  const mine = leaves.filter((l) => l.studentId === child.id);

  return (
    <>
      <PageHeader eyebrow={child.name} title="Leave." dim="Ask for a day off."
        actions={<Button variant="brand" disabled={left} onClick={() => setOpen(true)}><CalendarPlus /> Apply for leave</Button>} />
      {left && <Card className="py-4 text-sm text-muted-foreground">{child.name.split(" ")[0]} has left the school, so leave cannot be requested.</Card>}
      {mine.length === 0 ? <EmptyState icon={FileCheck2} title="No leave requests yet" text="Apply here and the class teacher will approve or reject it. You get a notification either way." /> : (
        <ul className="flex flex-col gap-3">
          {mine.map((l) => (
            <li key={l.id}>
              <Card className="flex flex-col gap-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{rangeLabel(l)}</p>
                  <LeaveStatusBadge status={l.status} />
                </div>
                <p className="text-sm">{l.reason}</p>
                {l.note && <p className="rounded-xl bg-fill px-3 py-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">{l.decidedBy ?? "Teacher"}:</span> {l.note}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-tertiary">
                  <span>Applied {formatIST(l.createdAt)} IST{l.decidedAt && ` · ${l.status === "approved" ? "Approved" : "Decided"} ${formatIST(l.decidedAt, "short")}`}</span>
                  {l.status === "pending" && <Button size="sm" variant="secondary" onClick={() => setCancelId(l.id)}>Cancel request</Button>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <ApplyLeaveDialog open={open} onOpenChange={setOpen} studentId={child.id} childName={child.name.split(" ")[0]} todayOn={today} />
      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancel this request?</DialogTitle><DialogDescription>The class teacher will no longer see it. You can apply again any time.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelId(null)}>Keep request</Button>
            <Button variant="destructive" loading={is("cancel")} onClick={() => run("cancel", () => { if (cancelId && cancelLeave(cancelId)) toast.success("Request cancelled"); setCancelId(null); })}>Cancel request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
