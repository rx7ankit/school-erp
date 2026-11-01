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
  const { run, is } = usePending(600);
  const [err, setErr] = React.useState("");
  React.useEffect(() => { if (open) setErr(""); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a custom class</DialogTitle>
          <DialogDescription>For classes outside grades 1 to 12, such as Nursery, LKG, UKG or Pre-primary. It works like any other class everywhere in Scool.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          const name = String(f.get("name"));
          run("custom", () => {
            const r = addCustomClass(name, Number(f.get("order")), String(f.get("section")).trim(), Number(f.get("capacity")));
            if (!r.ok) { setErr(r.error); return; }
            toast.success(`${name.trim()} added`, { description: "Choose its subjects next, then its teachers." }); onClose();
          });
        }}>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label="Class name" htmlFor="cc-name"><Input id="cc-name" name="name" placeholder="Nursery" maxLength={20} autoFocus required /></Field>
            <Field label="Order" htmlFor="cc-order" hint="Lower comes first"><Input id="cc-order" name="order" type="number" defaultValue={0} min={-50} max={99} required /></Field>
          </div>
          <p className="-mt-2 text-xs text-text-tertiary">Grades 1 to 12 use the order 1 to 12. Use 0 or lower to list a class before grade 1, for example Nursery -3, LKG -2, UKG -1.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First section" htmlFor="cc-sec"><Input id="cc-sec" name="section" defaultValue="A" maxLength={8} required /></Field>
            <Field label="Capacity" htmlFor="cc-cap" hint="Most students this section can hold"><Input id="cc-cap" name="capacity" type="number" min={1} max={100} defaultValue={30} required /></Field>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={is("custom")}>Add class</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
