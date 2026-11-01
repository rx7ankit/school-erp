"use client";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePending } from "@/lib/use-pending";

/** Change your own password. Used by staff, parents and the owner. */
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [error, setError] = React.useState("");
  const { run, is } = usePending();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next = String(f.get("next"));
    if (next.length < 8) return setError("Use at least 8 characters.");
    if (next !== f.get("again")) return setError("The two new passwords do not match.");
    if (next === f.get("current")) return setError("Choose a password different from the current one.");
    setError("");
    run("pw", () => { onOpenChange(false); toast.success("Password changed", { description: "Use the new password next time you sign in." }); });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change password</DialogTitle><DialogDescription>Only you should know it. Do not share it, even with the school office.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Current password" htmlFor="cur"><Input id="cur" name="current" type="password" autoComplete="current-password" required /></Field>
          <Field label="New password" htmlFor="new" hint="At least 8 characters."><Input id="new" name="next" type="password" autoComplete="new-password" required /></Field>
          <Field label="Repeat new password" htmlFor="again"><Input id="again" name="again" type="password" autoComplete="new-password" required /></Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="brand" loading={is("pw")}>Change password</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
