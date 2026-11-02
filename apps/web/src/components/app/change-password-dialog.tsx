"use client";
import { logAudit } from "@/lib/audit";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePending } from "@/lib/use-pending";
import { ApiError, api } from "@/lib/api/client";
import { isLive } from "@/lib/api/config";
import { useTr } from "@/lib/lang-context";

/** Change your own password. Used by staff, parents and the owner. */
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const tr = useTr();
  const [error, setError] = React.useState("");
  const { run, is } = usePending();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next = String(f.get("next"));
    if (next.length < 8) return setError(tr("pw.min", "Use at least 8 characters."));
    if (next !== f.get("again")) return setError(tr("pw.match", "The two new passwords do not match."));
    if (next === f.get("current")) return setError(tr("pw.same", "Choose a password different from the current one."));
    setError("");
    if (isLive) {
      run("pw", async () => {
        try {
          await api.post("/auth/change-password", { current_password: String(f.get("current")), new_password: next });
          onOpenChange(false); toast.success(tr("pw.changed", "Password changed"), { description: tr("pw.changedLive", "You are still signed in here. Other devices were signed out.") });
        } catch (err) { setError(err instanceof ApiError ? err.message : tr("pw.fail", "Could not change the password.")); }
      });
      return;
    }
    run("pw", () => { logAudit({ category: "security", action: "password.changed", summary: "Changed their password", sensitive: true }); onOpenChange(false); toast.success(tr("pw.changed", "Password changed"), { description: tr("pw.changedDemo", "Use the new password next time you sign in.") }); });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tr("pw.title", "Change password")}</DialogTitle><DialogDescription>{tr("pw.desc", "Only you should know it. Do not share it, even with the school office.")}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={tr("pw.current", "Current password")} htmlFor="cur"><Input id="cur" name="current" type="password" autoComplete="current-password" required /></Field>
          <Field label={tr("pw.new", "New password")} htmlFor="new" hint={tr("pw.hint", "At least 8 characters.")}><Input id="new" name="next" type="password" autoComplete="new-password" required /></Field>
          <Field label={tr("pw.again", "Repeat new password")} htmlFor="again"><Input id="again" name="again" type="password" autoComplete="new-password" required /></Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{tr("pw.cancel", "Cancel")}</Button><Button type="submit" variant="brand" loading={is("pw")}>{tr("pw.title", "Change password")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
