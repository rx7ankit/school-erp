"use client";
import * as React from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BLOOD_GROUPS, CATEGORIES, saveDetails, validateDetails, type DetailsInput, type StudentRecord } from "@/lib/student-record";
import { usePending } from "@/lib/use-pending";
import { FieldError } from "./field-error";
import { StudentPhoto } from "./student-photo";

const MAX_PHOTO = 1_500_000;
const pick = (r: StudentRecord): DetailsInput => ({
  photoUrl: r.photoUrl, bloodGroup: r.bloodGroup, category: r.category, samagraId: r.samagraId, pen: r.pen,
  previousSchool: r.previousSchool, medicalNotes: r.medicalNotes, emergencyName: r.emergencyName, emergencyPhone: r.emergencyPhone,
});

/** Editable (or read-only) form for the fuller record. */
export function DetailsTab({ studentId, name, record, canEdit }: { studentId: string; name: string; record: StudentRecord; canEdit: boolean }) {
  const [form, setForm] = React.useState<DetailsInput>(() => pick(record));
  const [errors, setErrors] = React.useState<Partial<Record<keyof DetailsInput, string>>>({});
  const file = React.useRef<HTMLInputElement>(null);
  const { run, is } = usePending();
  const set = <K extends keyof DetailsInput>(k: K, v: DetailsInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const ro = !canEdit;

  function onPhoto(f: File) {
    if (!f.type.startsWith("image/")) return toast.error("Choose an image file.");
    if (f.size > MAX_PHOTO) return toast.error("Photo should be under 1.5 MB.");
    const reader = new FileReader();
    reader.onload = () => set("photoUrl", String(reader.result));
    reader.readAsDataURL(f);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean: DetailsInput = { ...form, samagraId: form.samagraId.trim(), pen: form.pen.trim().toUpperCase(), emergencyPhone: form.emergencyPhone.trim(), emergencyName: form.emergencyName.trim() };
    const err = validateDetails(clean);
    setErrors(err);
    if (Object.keys(err).length) return toast.error("Fix the highlighted fields.");
    run("save", () => { saveDetails(studentId, clean); setForm(clean); toast.success("Details saved"); });
  }
  const invalid = (k: keyof DetailsInput) => (errors[k] ? true : undefined);

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Photo</CardTitle></CardHeader>
        <div className="flex flex-wrap items-center gap-4">
          <StudentPhoto name={name} url={form.photoUrl} className="size-20 text-xl" />
          {canEdit && (
            <div className="flex flex-wrap gap-2.5">
              <input ref={file} type="file" accept="image/*" className="sr-only" aria-label="Student photo" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ""; }} />
              <Button type="button" variant="secondary" onClick={() => file.current?.click()}><Camera /> {form.photoUrl ? "Change photo" : "Upload photo"}</Button>
              {form.photoUrl && <Button type="button" variant="ghost" onClick={() => set("photoUrl", undefined)}><Trash2 /> Remove</Button>}
            </div>
          )}
          {ro && !form.photoUrl && <p className="text-sm text-muted-foreground">No photo yet.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Blood group" htmlFor="bg"><NativeSelect id="bg" disabled={ro} value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)}>
            <option value="">Not recorded</option>{BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}</NativeSelect></Field>
          <Field label="Category" htmlFor="cat" hint="Used for concessions and reports."><NativeSelect id="cat" disabled={ro} value={form.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Not recorded</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
          <Field label="Samagra ID" htmlFor="samagra" hint="8 digits.">
            <Input id="samagra" inputMode="numeric" maxLength={8} disabled={ro} value={form.samagraId} aria-invalid={invalid("samagraId")} aria-describedby="samagra-err" onChange={(e) => set("samagraId", e.target.value.replace(/\D/g, ""))} />
            <FieldError id="samagra-err" message={errors.samagraId} /></Field>
          <Field label="PEN" htmlFor="pen" hint="11 letters or digits.">
            <Input id="pen" maxLength={11} disabled={ro} value={form.pen} aria-invalid={invalid("pen")} aria-describedby="pen-err" onChange={(e) => set("pen", e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} />
            <FieldError id="pen-err" message={errors.pen} /></Field>
          <div className="sm:col-span-2"><Field label="Previous school" htmlFor="prev"><Input id="prev" disabled={ro} value={form.previousSchool} onChange={(e) => set("previousSchool", e.target.value)} /></Field></div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Health and emergency</CardTitle></CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Medical notes" htmlFor="med" hint="Allergies, conditions, medicines. Visible to staff only.">
            <Textarea id="med" disabled={ro} value={form.medicalNotes} onChange={(e) => set("medicalNotes", e.target.value)} /></Field></div>
          <Field label="Emergency contact name" htmlFor="en">
            <Input id="en" disabled={ro} value={form.emergencyName} aria-invalid={invalid("emergencyName")} aria-describedby="en-err" onChange={(e) => set("emergencyName", e.target.value)} />
            <FieldError id="en-err" message={errors.emergencyName} /></Field>
          <Field label="Emergency contact mobile" htmlFor="ep">
            <Input id="ep" inputMode="tel" disabled={ro} value={form.emergencyPhone} aria-invalid={invalid("emergencyPhone")} aria-describedby="ep-err" onChange={(e) => set("emergencyPhone", e.target.value)} />
            <FieldError id="ep-err" message={errors.emergencyPhone} /></Field>
        </div>
      </Card>

      {canEdit
        ? <div className="flex justify-end"><Button type="submit" variant="brand" loading={is("save")}>Save details</Button></div>
        : <p className="text-sm text-muted-foreground">You can view this record. Only the academic manager or admin can edit it.</p>}
    </form>
  );
}
