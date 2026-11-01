"use client";
import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Student } from "@/lib/mock";
import { RELATIONS, isPhone, removeGuardian, saveGuardian, type ExtraGuardian, type StudentRecord } from "@/lib/student-record";
import { usePending } from "@/lib/use-pending";
import { FieldError } from "./field-error";

type Draft = Omit<ExtraGuardian, "id"> & { id?: string };
const blank: Draft = { name: "", relation: "Mother", phone: "", email: "", occupation: "", isEmergency: false };

function GuardianRow({ title, badges, lines, actions }: { title: string; badges: React.ReactNode; lines: string[]; actions?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-fill px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{title}</p>{badges}</div>
        {lines.filter(Boolean).map((l) => <p key={l} className="break-words text-[13px] text-muted-foreground">{l}</p>)}
      </div>
      {actions && <div className="flex gap-1">{actions}</div>}
    </li>
  );
}

export function GuardiansTab({ student, record, canEdit }: { student: Student; record: StudentRecord; canEdit: boolean }) {
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [removing, setRemoving] = React.useState<ExtraGuardian | null>(null);
  const { run, is } = usePending();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  function open(d: Draft) { setErrors({}); setDraft(d); }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const err: Record<string, string> = {};
    if (!draft.name.trim()) err.name = "Enter a name.";
    if (!isPhone(draft.phone)) err.phone = "Mobile should be 10 digits.";
    if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) err.email = "Enter a valid email.";
    setErrors(err);
    if (Object.keys(err).length) return;
    run("g", () => {
      saveGuardian(student.id, { ...draft, name: draft.name.trim(), email: draft.email?.trim() || undefined, occupation: draft.occupation?.trim() || undefined });
      toast.success(draft.id ? "Guardian updated" : "Guardian added");
      setDraft(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guardians</CardTitle>
        {canEdit && <Button variant="secondary" size="sm" onClick={() => open(blank)}><Plus /> Add guardian</Button>}
      </CardHeader>
      <ul className="flex flex-col gap-3">
        <GuardianRow title={student.guardian} badges={<Badge tone="brand">Primary · parent login</Badge>}
          lines={[student.phone, student.guardianEmail]} />
        {record.guardians.map((g) => (
          <GuardianRow key={g.id} title={g.name} badges={<><Badge>{g.relation}</Badge>{g.isEmergency && <Badge tone="warning">Emergency contact</Badge>}</>}
            lines={[g.phone, g.email ?? "", g.occupation ?? ""]}
            actions={canEdit && <>
              <Button variant="ghost" size="icon" aria-label={`Edit ${g.name}`} onClick={() => open(g)}><Pencil /></Button>
              <Button variant="ghost" size="icon" aria-label={`Remove ${g.name}`} onClick={() => setRemoving(g)}><Trash2 /></Button>
            </>} />
        ))}
      </ul>
      <p className="mt-4 text-xs text-text-tertiary">The primary guardian holds the parent app login and cannot be removed. Other guardians are contacts only.</p>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit guardian" : "Add guardian"}</DialogTitle><DialogDescription>Contacts the school can call. They do not get a login.</DialogDescription></DialogHeader>
          {draft && (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="gname"><Input id="gname" value={draft.name} aria-invalid={errors.name ? true : undefined} aria-describedby="gname-err" onChange={(e) => set("name", e.target.value)} /><FieldError id="gname-err" message={errors.name} /></Field>
                <Field label="Relation" htmlFor="grel"><NativeSelect id="grel" value={draft.relation} onChange={(e) => set("relation", e.target.value)}>{RELATIONS.filter((r) => r !== "Father" || draft.relation === "Father").map((r) => <option key={r}>{r}</option>)}</NativeSelect></Field>
                <Field label="Mobile" htmlFor="gphone"><Input id="gphone" inputMode="tel" value={draft.phone} aria-invalid={errors.phone ? true : undefined} aria-describedby="gphone-err" onChange={(e) => set("phone", e.target.value)} /><FieldError id="gphone-err" message={errors.phone} /></Field>
                <Field label="Email (optional)" htmlFor="gemail"><Input id="gemail" type="email" value={draft.email ?? ""} aria-invalid={errors.email ? true : undefined} aria-describedby="gemail-err" onChange={(e) => set("email", e.target.value)} /><FieldError id="gemail-err" message={errors.email} /></Field>
              </div>
              <Field label="Occupation (optional)" htmlFor="gocc"><Input id="gocc" value={draft.occupation ?? ""} onChange={(e) => set("occupation", e.target.value)} /></Field>
              <div className="flex items-center gap-3"><Checkbox id="gem" checked={draft.isEmergency} onCheckedChange={(c) => set("isEmergency", c === true)} /><Label htmlFor="gem">Emergency contact</Label></div>
              <DialogFooter><Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button type="submit" variant="brand" loading={is("g")}>{draft.id ? "Save" : "Add guardian"}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove {removing?.name}?</DialogTitle><DialogDescription>They will no longer be listed as a contact for {student.name}.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" loading={is("rm")} onClick={() => run("rm", () => { if (removing) removeGuardian(student.id, removing.id); setRemoving(null); toast.success("Guardian removed"); })}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
