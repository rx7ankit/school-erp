"use client";
import * as React from "react";
import { Megaphone, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { BODY_MAX, GENERAL, audienceOf, sendBroadcast, subjectOf } from "@/lib/messaging";
import { CLASSES, SUBJECTS_ALL, className, type StaffRow } from "@/lib/mock";
import { hasAccess } from "@/lib/permissions";
import { usePending } from "@/lib/use-pending";

type Scope = "mine" | "school" | "selected";

/** Compose a broadcast. Teachers: their class, and the subjects they may use. Admin and academic managers: also the whole school or chosen classes. */
export function BroadcastForm({ user }: { user: StaffRow }) {
  const canSchool = hasAccess(user, "academic.manage");
  const mine = user.isAdmin ? CLASSES.map((c) => c.id) : user.classes.map((c) => c.classId);
  const scopes: [Scope, string][] = [
    ...(mine.length ? [["mine", user.classes.length ? "My class" : "One class"] as [Scope, string]] : []),
    ...(canSchool ? [["school", "Whole school"] as [Scope, string], ["selected", "Selected classes"] as [Scope, string]] : []),
  ];
  const [scopeRaw, setScope] = React.useState<Scope>(scopes[0]?.[0] ?? "mine");
  const scope = scopes.some(([v]) => v === scopeRaw) ? scopeRaw : scopes[0]?.[0] ?? "mine";
  const [classRaw, setClass] = React.useState("");
  const [subjectRaw, setSubject] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [body, setBody] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const { run, is } = usePending();

  const classId = mine.includes(classRaw) ? classRaw : mine[0] ?? "";
  const asg = user.classes.find((c) => c.classId === classId);
  // Class teacher (and admin): any subject or General. Subject teacher: only their own.
  const subjects = user.isAdmin || asg?.role === "class_teacher" ? [GENERAL, ...SUBJECTS_ALL] : [asg ? subjectOf(asg) : GENERAL];
  const subject = subjects.includes(subjectRaw) ? subjectRaw : subjects[0];
  const schoolLevel = scope !== "mine";
  const classIds = scope === "mine" ? [classId] : scope === "selected" ? picked : [];
  const count = scope === "selected" && picked.length === 0 ? 0 : audienceOf(schoolLevel ? "school" : "class", classIds).length;
  const togglePicked = (id: string, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    if (scope === "selected" && picked.length === 0) { toast.error("Choose at least one class."); return; }
    run("bc", () => {
      const r = sendBroadcast({ scope: schoolLevel ? "school" : "class", classIds, subject, body, file: file?.name, sender: { id: user.id, name: user.name } });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Sent to ${r.count} ${r.count === 1 ? "parent" : "parents"}`);
      setBody(""); setFile(null); if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>New broadcast</CardTitle></CardHeader>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {scopes.length > 1 && (
          <Field label="Send to" htmlFor="bc-scope">
            <NativeSelect id="bc-scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>{scopes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
          </Field>
        )}
        {scope === "mine" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Class" htmlFor="bc-class"><NativeSelect id="bc-class" value={classId} onChange={(e) => setClass(e.target.value)}>{mine.map((id) => <option key={id} value={id}>{className(id)}</option>)}</NativeSelect></Field>
            <Field label="Subject" htmlFor="bc-subject"><NativeSelect id="bc-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
          </div>
        )}
        {scope === "selected" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Classes</legend>
            <div className="flex flex-wrap gap-2">
              {CLASSES.map((c) => (
                <label key={c.id} htmlFor={`bc-c-${c.id}`} className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-fill px-3.5 text-sm">
                  <Checkbox id={`bc-c-${c.id}`} checked={picked.includes(c.id)} onCheckedChange={(on) => togglePicked(c.id, on === true)} />{className(c.id)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {schoolLevel && <p className="text-xs text-text-tertiary">Parents see this as a <strong className="font-medium text-foreground">School notice</strong>.</p>}
        <Field label="Message" htmlFor="bc-body">
          <Textarea id="bc-body" value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder={schoolLevel ? "Notice for parents" : "Homework, notes, study material..."} />
        </Field>
        <input ref={fileRef} type="file" className="sr-only" aria-label="Attach material" tabIndex={-1} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => fileRef.current?.click()}><Paperclip /> <span className="max-w-48 truncate">{file ? file.name : "Attach material"}</span></Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">Goes to {count} {count === 1 ? "parent" : "parents"}</p>
          <Button type="submit" variant="brand" loading={is("bc")} disabled={!body.trim() || count === 0}><Megaphone /> Send</Button>
        </div>
        {user.classes.length > 0 && !user.isAdmin && scope === "mine" && asg?.role !== "class_teacher" && <p className="text-xs text-text-tertiary">You teach {asg ? subjectOf(asg) : "this class"} in this class, so you can broadcast for that subject.</p>}
      </form>
    </Card>
  );
}
