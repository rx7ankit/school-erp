"use client";
import { isLive } from "@/lib/api/config";
import { LeaveLive } from "@/components/parent/leave-live";
import * as React from "react";
import { CalendarPlus, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ApplyLeaveDialog } from "@/components/app/leave/apply-leave-dialog";
import { LeaveStatusBadge, useRangeLabel } from "@/components/app/leave/leave-bits";
import { useChild } from "@/components/parent-child";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelLeave, useLeaves } from "@/lib/leave";
import { useFmt } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";
import { usePending } from "@/lib/use-pending";
import { useTodayIST } from "@/lib/use-today";

function ParentLeaveDemo() {
  const t = useT(), f = useFmt(), rangeLabel = useRangeLabel();
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
      <PageHeader title={t("lv.title")}
        actions={<Button variant="brand" disabled={left} onClick={() => setOpen(true)}><CalendarPlus /> {t("lv.apply")}</Button>} />
      {left && <Card className="py-4 text-sm text-muted-foreground">{t("pl.leftNote", { name: child.name.split(" ")[0] })}</Card>}
      {mine.length === 0 ? <EmptyState icon={FileCheck2} title={t("lv.emptyTitle")} /> : (
        <ul className="flex flex-col gap-3">
          {mine.map((l) => (
            <li key={l.id}>
              <Card className="flex flex-col gap-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{rangeLabel(l)}</p>
                  <LeaveStatusBadge status={l.status} />
                </div>
                <p className="text-sm">{l.reason}</p>
                {l.note && <p className="rounded-xl bg-fill px-3 py-2 text-sm text-muted-foreground"><span className="font-medium text-foreground">{l.decidedBy ?? t("lv.teacher")}:</span> {l.note}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-tertiary">
                  <span>{t("lv.applied", { date: f.ist(l.createdAt) })}{l.decidedAt && ` · ${t(l.status === "approved" ? "lv.approved" : "lv.decided", { date: f.ist(l.decidedAt, "short") })}`}</span>
                  {l.status === "pending" && <Button size="sm" variant="secondary" onClick={() => setCancelId(l.id)}>{t("lv.cancel")}</Button>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <ApplyLeaveDialog open={open} onOpenChange={setOpen} studentId={child.id} childName={child.name.split(" ")[0]} todayOn={today} />
      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("lv.cancelTitle")}</DialogTitle><DialogDescription className="sr-only">{t("lv.cancelText")}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelId(null)}>{t("lv.keep")}</Button>
            <Button variant="destructive" loading={is("cancel")} onClick={() => run("cancel", () => { if (cancelId && cancelLeave(cancelId)) toast.success(t("lv.cancelled")); setCancelId(null); })}>{t("lv.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ParentLeave() {
  return isLive ? <LeaveLive /> : <ParentLeaveDemo />;
}
