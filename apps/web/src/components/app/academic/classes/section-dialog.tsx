"use client";
import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { addSection, nextSection, sectionsOfGrade, updateSection, type SetupClass } from "@/lib/academic-setup";
import { className } from "@/lib/mock";
import { usePending } from "@/lib/use-pending";

export type SectionMode = { kind: "add"; grade: string; custom: boolean } | { kind: "edit"; cls: SetupClass };

/** Add a section to a grade (next letter suggested, free text allowed) or edit one with its capacity. */
export function SectionDialog({ mode, onClose }: { mode: SectionMode | null; onClose: () => void }) {
  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{mode && <SectionBody mode={mode} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SectionBody({ mode, onClose }: { mode: SectionMode; onClose: () => void }) {
  const { run, is } = usePending(600);
  const [err, setErr] = React.useState("");
  const edit = mode?.kind === "edit" ? mode.cls : null;
  const grade = mode ? (mode.kind === "add" ? mode.grade : mode.cls.grade) : "";
  const custom = mode ? (mode.kind === "add" ? mode.custom : !!mode.cls.custom) : false;
  const sibling = mode?.kind === "add" ? sectionsOfGrade(grade).at(-1) : undefined;
  const suggestion = mode?.kind === "add" ? nextSection(grade) : "";
  const title = !mode ? "" : edit ? `Edit class ${className(edit.id)}` : `Add a section to ${custom ? grade : `class ${grade}`}`;

  return (
    <>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{edit ? "Students stay in the class when you rename it." : `We suggest section ${suggestion}. Type another name if your school uses one, such as Rose.`}</DialogDescription>
        </DialogHeader>
        <form key={edit?.id ?? `add-${grade}-${suggestion}`} className="flex flex-col gap-4" onSubmit={(e) => {
          e.preventDefault(); if (!mode) return; const f = new FormData(e.currentTarget);
          const [section, capacity] = [String(f.get("section")), Number(f.get("capacity"))];
          run("section", () => {
            const r = edit ? updateSection(edit.id, section, capacity, custom ? { name: String(f.get("name")), order: Number(f.get("order")) } : undefined) : addSection(grade, section, capacity);
            if (!r.ok) { setErr(r.error); return; }
            toast.success(edit ? "Class updated" : `Class ${grade}-${section.trim().toUpperCase()} added`); onClose();
          });
        }}>
          {edit && custom && (
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Class name" htmlFor="sd-name"><Input id="sd-name" name="name" defaultValue={edit.grade} required /></Field>
              <Field label="Order" htmlFor="sd-order"><Input id="sd-order" name="order" type="number" defaultValue={edit.order} required /></Field>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Section" htmlFor="sd-section" hint="A, B, C or any short name"><Input id="sd-section" name="section" maxLength={8} defaultValue={edit ? edit.section : suggestion} autoFocus required /></Field>
            <Field label="Capacity" htmlFor="sd-cap" hint="Most students this section can hold"><Input id="sd-cap" name="capacity" type="number" min={1} max={100} defaultValue={edit ? edit.capacity : sibling ? (sectionsOfGrade(grade).at(-1)?.capacity ?? 40) : 40} required /></Field>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <DialogFooter><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" loading={is("section")}>{edit ? "Save" : "Add section"}</Button></DialogFooter>
        </form>
    </>
  );
}
