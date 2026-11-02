"use client";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addCustomClass } from "@/lib/academic-setup";
import { usePending } from "@/lib/use-pending";

/** For classes outside grades 1 to 12: Nursery, LKG, UKG, KG-1, Pre-primary... */
export function CustomClassDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{open && <CustomBody onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function CustomBody({ onClose }: { onClose: () => void }) {
  const { run, is } = usePending(600);
  const [err, setErr] = React.useState("");
  return (
    <>
        <DialogHeader>
          <DialogTitle>Custom class</DialogTitle>
          <DialogDescription className="sr-only">For classes outside grades 1 to 12.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          const name = String(f.get("name"));
          run("custom", () => {
            const r = addCustomClass(name, Number(f.get("order")), String(f.get("section")).trim(), Number(f.get("capacity")));
            if (!r.ok) { setErr(r.error); return; }
            toast.success(`${name.trim()} added`); onClose();
          });
        }}>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label="Name" htmlFor="cc-name"><Input id="cc-name" name="name" maxLength={20} autoFocus required /></Field>
            <Field label="Order" htmlFor="cc-order"><Input id="cc-order" name="order" type="number" defaultValue={0} min={-50} max={99} required /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Section" htmlFor="cc-sec"><Input id="cc-sec" name="section" defaultValue="A" maxLength={8} required /></Field>
            <Field label="Capacity" htmlFor="cc-cap"><Input id="cc-cap" name="capacity" type="number" min={1} max={100} defaultValue={30} required /></Field>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={is("custom")}>Add</Button></DialogFooter>
        </form>
    </>
  );
}
