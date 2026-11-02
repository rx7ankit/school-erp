"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePending } from "@/lib/use-pending";

/** Plain confirmation with a spinner on the confirm button. */
export function ConfirmDialog({ open, onClose, title, description, confirmLabel, danger, onConfirm, children }: {
  open: boolean; onClose: () => void; title: string; description: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; children?: React.ReactNode;
}) {
  const { run, is } = usePending(500);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "destructive" : "brand"} loading={is("go")} onClick={() => run("go", () => { onConfirm(); onClose(); })}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
