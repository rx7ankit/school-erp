"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/app/field";
import { usePending } from "@/lib/use-pending";

const MIN = 5;

/** Asks for a reason (at least 5 characters) and an explicit confirmation before a risky change. */
export function ReasonDialog({ open, onClose, title, description, summary, confirmLabel, acknowledge, danger = true, onConfirm }: {
  open: boolean; onClose: () => void; title: string; description: string; summary?: React.ReactNode;
  confirmLabel: string; acknowledge?: string; danger?: boolean; onConfirm: (reason: string) => string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{open && <Body {...{ onClose, title, description, summary, confirmLabel, acknowledge, danger, onConfirm }} />}</DialogContent>
    </Dialog>
  );
}

/** Mounted only while open, so the form starts empty each time. onConfirm returns an error message or null. */
function Body({ onClose, title, description, summary, confirmLabel, acknowledge, danger, onConfirm }: Omit<Parameters<typeof ReasonDialog>[0], "open">) {
  const [reason, setReason] = React.useState("");
  const [ack, setAck] = React.useState(false);
  const [error, setError] = React.useState("");
  const { run, is } = usePending(500);
  const short = reason.trim().length < MIN;
  return (
    <>
      <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
      {summary && <div className="rounded-xl bg-card px-4 py-3 text-sm">{summary}</div>}
      <Field label="Reason" htmlFor="reason-text">
        <Textarea id="reason-text" value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder="Reason" />
      </Field>
      {acknowledge && (
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} aria-label={acknowledge} className="mt-0.5" />
          <span>{acknowledge}</span>
        </label>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "destructive" : "brand"} loading={is("go")} disabled={short || (!!acknowledge && !ack)}
          onClick={() => run("go", () => { const err = onConfirm(reason); if (err) setError(err); else onClose(); })}>{confirmLabel}</Button>
      </DialogFooter>
    </>
  );
}
