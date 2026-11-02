"use client";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addSubject, updateSubject, type SetupClass, type Subject } from "@/lib/academic-setup";
import { usePending } from "@/lib/use-pending";

/** Add or edit a subject. When adding, choose the grades that study it right away. */
export function SubjectDialog({ target, groups, onClose }: { target: Subject | "new" | null; groups: { title: string; sections: SetupClass[] }[]; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{target && <SubjectBody target={target} groups={groups} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SubjectBody({ target, groups, onClose }: { target: Subject | "new"; groups: { title: string; sections: SetupClass[] }[]; onClose: () => void }) {
  const { run, is } = usePending(600);
  const [err, setErr] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const edit = target !== "new" ? target : null;
  const allPicked = groups.length > 0 && picked.length === groups.length;
  return (
    <>
        <DialogHeader>
          <DialogTitle>{edit ? "Edit subject" : "Add subject"}</DialogTitle>
          <DialogDescription className="sr-only">Subject details.</DialogDescription>
        </DialogHeader>
        <form key={edit?.id ?? "new"} className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          const [name, code] = [String(f.get("name")), String(f.get("code"))];
          const classIds = groups.filter((g) => picked.includes(g.title)).flatMap((g) => g.sections.map((c) => c.id));
          run("subject", () => {
            const r = edit ? updateSubject(edit.id, name, code) : addSubject(name, code, classIds);
            if (!r.ok) { setErr(r.error); return; }
            toast.success(edit ? "Saved" : "Subject added"); onClose();
          });
        }}>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label="Name" htmlFor="sn"><Input id="sn" name="name" defaultValue={edit?.name ?? ""} autoFocus required /></Field>
            <Field label="Code" htmlFor="sc"><Input id="sc" name="code" maxLength={5} defaultValue={edit?.code ?? ""} required /></Field>
          </div>
          {!edit && groups.length > 0 && (
            <fieldset>
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium">
                <span>Classes</span>
                <button type="button" className="text-xs font-medium text-foreground hover:underline" onClick={() => setPicked(allPicked ? [] : groups.map((g) => g.title))}>{allPicked ? "Clear" : "Select all"}</button>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {groups.map((g) => (
                  <label key={g.title} className="flex items-center gap-2 rounded-xl bg-fill px-3 py-2 text-sm">
                    <Checkbox checked={picked.includes(g.title)} onCheckedChange={(on) => setPicked((p) => (on === true ? [...p, g.title] : p.filter((x) => x !== g.title)))} />{g.title}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={is("subject")}>{edit ? "Save" : "Add"}</Button></DialogFooter>
        </form>
    </>
  );
}
