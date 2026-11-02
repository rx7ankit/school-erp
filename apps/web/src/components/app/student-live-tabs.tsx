"use client";
import * as React from "react";
import { Camera, Eye, Lock, Pencil, Plus, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorBlock, LoadingBlock } from "@/components/app/academic-live-ui";
import { Field } from "@/components/app/field";
import { Problem } from "@/components/app/school-bits";
import { StudentPhoto } from "@/components/app/student/student-photo";
import { BLOOD_GROUPS, CATEGORIES } from "@/components/app/students-live";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/lib/api/hooks/staff";
import {
  DOC_KINDS, DOC_LABEL, documentUrl, useAddDocument, useAddGuardian, useDeleteDocument, useEditGuardian, useEditGuardianLink, useEditStudent,
  useRemoveGuardian, useSendGuardianLogin, useSetPhoto, useStudentDocs, type GuardianOut, type StudentDetail, type StudentPatch,
} from "@/lib/api/hooks/students";
import { formatIST } from "@/lib/time";

/* ------------------------------------------------------------------ photo */
export function PhotoPicker({ s }: { s: StudentDetail }) {
  const set = useSetPhoto();
  const input = React.useRef<HTMLInputElement>(null);
  function pick(f: File) {
    if (!f.type.startsWith("image/")) return toast.error("Choose an image file.");
    if (f.size > 3 * 1024 * 1024) return toast.error("Max 3 MB.");
    set.mutate({ id: s.id, file: f }, { onSuccess: () => toast.success("Photo saved"), onError: (e) => toast.error("Photo not saved", { description: errorText(e) }) });
  }
  return (
    <div className="flex items-center gap-1">
      <StudentPhoto name={s.name} url={s.photo_url ?? undefined} className="size-10" />
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Student photo" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
      <Button variant="ghost" size="icon-sm" aria-label={s.photo_url ? "Change photo" : "Upload photo"} loading={set.isPending && !!set.variables?.file} onClick={() => input.current?.click()}><Camera /></Button>
      {s.photo_url && <Button variant="ghost" size="icon-sm" aria-label="Remove photo" loading={set.isPending && !set.variables?.file} onClick={() => set.mutate({ id: s.id, file: null }, { onError: (e) => toast.error("Photo not removed", { description: errorText(e) }) })}><Trash2 /></Button>}
    </div>
  );
}

/* ------------------------------------------------------------------ details */
const FIELDS = ["first_name", "last_name", "dob", "gender", "address", "blood_group", "category", "samagra_id", "pen", "previous_school", "medical_notes", "emergency_name", "emergency_phone", "admitted_on", "scholar_no"] as const;
type FieldKey = (typeof FIELDS)[number];

export function DetailsTabLive({ s, canEdit }: { s: StudentDetail; canEdit: boolean }) {
  const edit = useEditStudent();
  const initial = React.useMemo(() => Object.fromEntries(FIELDS.map((k) => [k, (s[k as keyof StudentDetail] as string | null) ?? ""])) as Record<FieldKey, string>, [s]);
  const [form, setForm] = React.useState(initial);
  const [err, setErr] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const set = (k: FieldKey, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ro = !canEdit;
  const bad = (k: FieldKey) => (fields[k] ? true : undefined);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setFields({});
    const body: Record<string, string | null> = {};
    for (const k of FIELDS) if (form[k].trim() !== initial[k]) body[k] = form[k].trim() === "" ? null : form[k].trim();
    if (!Object.keys(body).length) return toast.message("No changes");
    edit.mutate({ id: s.id, body: body as StudentPatch }, {
      onSuccess: () => toast.success("Details saved"),
      onError: (e2) => { setErr(errorText(e2)); setFields((e2 as { fields?: Record<string, string> }).fields ?? {}); },
    });
  }
  const text = (k: FieldKey, label: string, o: { type?: string; hint?: string; required?: boolean; inputMode?: "numeric" | "tel" } = {}) => (
    <Field label={label} htmlFor={`d-${k}`} hint={fields[k] ?? o.hint}>
      <Input id={`d-${k}`} type={o.type} inputMode={o.inputMode} required={o.required} disabled={ro} aria-invalid={bad(k)} value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Student</CardTitle></CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("first_name", "First name", { required: true })}{text("last_name", "Last name")}
          {text("scholar_no", "Scholar no.")}{text("dob", "Born", { type: "date" })}
          <Field label="Gender" htmlFor="d-gender"><NativeSelect id="d-gender" disabled={ro} value={form.gender} onChange={(e) => set("gender", e.target.value)}><option value="">None</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></NativeSelect></Field>
          {text("admitted_on", "Admitted", { type: "date" })}
          <div className="sm:col-span-2">{text("address", "Address")}</div>
        </div>
      </Card>
      <Card>
        <CardHeader><CardTitle>Record</CardTitle></CardHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Blood group" htmlFor="d-blood_group"><NativeSelect id="d-blood_group" disabled={ro} value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)}><option value="">None</option>{BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}</NativeSelect></Field>
          <Field label="Category" htmlFor="d-category"><NativeSelect id="d-category" disabled={ro} value={form.category} onChange={(e) => set("category", e.target.value)}><option value="">None</option>{CATEGORIES.map((b) => <option key={b}>{b}</option>)}</NativeSelect></Field>
          {text("samagra_id", "Samagra ID", { inputMode: "numeric" })}{text("pen", "PEN")}
          <div className="sm:col-span-2">{text("previous_school", "Previous school")}</div>
          {text("emergency_name", "Emergency name")}{text("emergency_phone", "Emergency mobile", { inputMode: "tel" })}
          <div className="sm:col-span-2"><Field label="Medical notes" htmlFor="d-medical_notes" hint={fields.medical_notes}><Textarea id="d-medical_notes" disabled={ro} value={form.medical_notes} onChange={(e) => set("medical_notes", e.target.value)} /></Field></div>
        </div>
      </Card>
      <Problem text={err} />
      {canEdit && <div className="flex justify-end"><Button type="submit" variant="brand" loading={edit.isPending}>Save</Button></div>}
    </form>
  );
}

/* ------------------------------------------------------------------ guardians */
const LOGIN: Record<string, readonly [string, "neutral" | "warning" | "success" | "danger"]> = {
  none: ["No login", "neutral"], pending: ["Not sent", "neutral"], sent: ["Sent", "warning"], failed: ["Failed", "danger"], active: ["Active", "success"],
};
type GDraft = { id?: string; name: string; relation: string; phone: string; email: string; occupation: string; is_primary: boolean; is_emergency: boolean; send: boolean };
const blank: GDraft = { name: "", relation: "mother", phone: "", email: "", occupation: "", is_primary: false, is_emergency: false, send: false };

export function GuardiansTabLive({ s, canEdit }: { s: StudentDetail; canEdit: boolean }) {
  const add = useAddGuardian(), editG = useEditGuardian(), link = useEditGuardianLink(), remove = useRemoveGuardian(), send = useSendGuardianLogin();
  const [draft, setDraft] = React.useState<GDraft | null>(null);
  const [removing, setRemoving] = React.useState<GuardianOut | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const set = <K extends keyof GDraft>(k: K, v: GDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const open = (d: GDraft) => { setErr(null); setDraft(d); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setErr(null);
    const clean = (v: string) => v.trim() || null;
    try {
      if (draft.id) {
        await editG.mutateAsync({ guardianId: draft.id, body: { name: draft.name.trim(), phone: clean(draft.phone), email: clean(draft.email), occupation: clean(draft.occupation) } });
        await link.mutateAsync({ id: s.id, guardianId: draft.id, body: { relation: draft.relation, is_primary: draft.is_primary, is_emergency: draft.is_emergency } });
        toast.success("Guardian updated");
      } else {
        await add.mutateAsync({ id: s.id, body: { name: draft.name.trim(), relation: draft.relation as "mother", phone: clean(draft.phone), email: clean(draft.email) ?? undefined, occupation: clean(draft.occupation), is_primary: draft.is_primary, is_emergency: draft.is_emergency, create_login: draft.send, send_login: draft.send } });
        toast.success("Guardian added");
      }
      setDraft(null);
    } catch (e2) { setErr(errorText(e2)); }
  }
  const sendLogin = (g: GuardianOut) => send.mutate(g.id, {
    onSuccess: (r) => (r.failed ? toast.error("Email failed") : toast.success("Login sent")),
    onError: (e) => toast.error("Login not sent", { description: errorText(e) }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Guardians</CardTitle>
        {canEdit && <Button variant="secondary" size="sm" onClick={() => open(blank)}><Plus /> Add</Button>}
      </CardHeader>
      {s.guardians.length === 0 ? <p className="text-sm text-muted-foreground">No guardians.</p> : (
        <ul className="flex flex-col gap-3">
          {s.guardians.map((g) => {
            const [label, tone] = LOGIN[g.login_status] ?? LOGIN.none;
            return (
              <li key={g.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-fill px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{g.name}</p><Badge className="capitalize">{g.relation}</Badge>
                    {g.is_primary && <Badge tone="brand">Primary</Badge>}{g.is_emergency && <Badge tone="warning">Emergency</Badge>}
                    <Badge tone={tone}>{label}</Badge>
                  </div>
                  {[g.phone, g.email, g.occupation].filter(Boolean).map((l) => <p key={l} className="break-words text-[13px] text-muted-foreground">{l}</p>)}
                  {g.last_login_at && <p className="text-xs text-text-tertiary">Last in {formatIST(g.last_login_at)}</p>}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    {g.email && g.login_status !== "active" && <Button size="sm" variant="brand" loading={send.isPending && send.variables === g.id} onClick={() => sendLogin(g)}><Send /> {g.login_status === "sent" || g.login_status === "failed" ? "Resend" : "Send login"}</Button>}
                    <Button variant="ghost" size="icon" aria-label={`Edit ${g.name}`} onClick={() => open({ id: g.id, name: g.name, relation: g.relation, phone: g.phone ?? "", email: g.email ?? "", occupation: g.occupation ?? "", is_primary: g.is_primary, is_emergency: g.is_emergency, send: false })}><Pencil /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${g.name}`} onClick={() => { setErr(null); setRemoving(g); }}><Trash2 /></Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit guardian" : "Add guardian"}</DialogTitle><DialogDescription className="sr-only">Guardian details.</DialogDescription></DialogHeader>
          {draft && (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="gname"><Input id="gname" required value={draft.name} onChange={(e) => set("name", e.target.value)} /></Field>
                <Field label="Relation" htmlFor="grel"><NativeSelect id="grel" value={draft.relation} onChange={(e) => set("relation", e.target.value)}><option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option><option value="other">Other</option></NativeSelect></Field>
                <Field label="Mobile" htmlFor="gphone"><Input id="gphone" inputMode="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
                <Field label="Email" htmlFor="gemail"><Input id="gemail" type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} /></Field>
              </div>
              <Field label="Occupation" htmlFor="gocc"><Input id="gocc" value={draft.occupation} onChange={(e) => set("occupation", e.target.value)} /></Field>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <div className="flex items-center gap-3"><Checkbox id="gprim" checked={draft.is_primary} onCheckedChange={(c) => set("is_primary", c === true)} /><Label htmlFor="gprim">Primary guardian</Label></div>
                <div className="flex items-center gap-3"><Checkbox id="gem" checked={draft.is_emergency} onCheckedChange={(c) => set("is_emergency", c === true)} /><Label htmlFor="gem">Emergency contact</Label></div>
                {!draft.id && <div className="flex items-center gap-3"><Checkbox id="gsend" checked={draft.send} onCheckedChange={(c) => set("send", c === true)} /><Label htmlFor="gsend">Email parent login</Label></div>}
              </div>
              <Problem text={err} />
              <DialogFooter><Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button type="submit" variant="brand" loading={add.isPending || editG.isPending || link.isPending}>{draft.id ? "Save" : "Add"}</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove guardian?</DialogTitle><DialogDescription>{removing?.name}</DialogDescription></DialogHeader>
          <Problem text={err} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" loading={remove.isPending} onClick={() => removing && remove.mutate({ id: s.id, guardianId: removing.id }, { onSuccess: () => { setRemoving(null); toast.success("Guardian removed"); }, onError: (e) => setErr(errorText(e)) })}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------------------------------------ documents */
const MAX_DOC = 10 * 1024 * 1024;
const fileSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function DocumentsTabLive({ id }: { id: string }) {
  const docs = useStudentDocs(id, true);
  const add = useAddDocument(id), del = useDeleteDocument(id);
  const [kind, setKind] = React.useState<string>("birth_certificate");
  const [opening, setOpening] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<{ id: string; name: string } | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  function onFile(f: File) {
    if (f.size > MAX_DOC) return toast.error("Max 10 MB.");
    add.mutate({ file: f, kind }, { onSuccess: () => toast.success(`${f.name} uploaded`), onError: (e) => toast.error("Upload failed", { description: errorText(e) }) });
  }
  async function view(docId: string) {
    setOpening(docId);
    try { window.open((await documentUrl(id, docId)).url, "_blank", "noopener"); }
    catch (e) { toast.error("Could not open", { description: errorText(e) }); }
    finally { setOpening(null); }
  }
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56"><Field label="Type" htmlFor="dkind"><NativeSelect id="dkind" value={kind} onChange={(e) => setKind(e.target.value)}>{DOC_KINDS.map((k) => <option key={k} value={k}>{DOC_LABEL[k]}</option>)}</NativeSelect></Field></div>
          <input ref={input} type="file" accept=".pdf,image/*" className="sr-only" aria-label="Document file" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <Button variant="brand" loading={add.isPending} onClick={() => input.current?.click()}><Upload /> Choose file</Button>
        </div>
      </Card>
      <Card>
        <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
        {docs.isPending ? <LoadingBlock label="Loading" /> : docs.isError ? <ErrorBlock error={docs.error} onRetry={() => docs.refetch()} /> : docs.data.length === 0 ? (
          <EmptyState icon={Lock} title="No documents" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>File</TableHead><TableHead>Uploaded</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
              {docs.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{DOC_LABEL[d.kind as keyof typeof DOC_LABEL] ?? d.kind}</TableCell>
                  <TableCell><p className="break-all">{d.filename ?? "File"}</p>{d.size_bytes != null && <p className="text-xs text-text-tertiary">{fileSize(d.size_bytes)}</p>}</TableCell>
                  <TableCell className="text-sm tabular-nums">{formatIST(d.created_at)}</TableCell>
                  <TableCell><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Open ${d.filename ?? "document"}`} loading={opening === d.id} onClick={() => view(d.id)}><Eye /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${d.filename ?? "document"}`} onClick={() => setRemoving({ id: d.id, name: d.filename ?? "this document" })}><Trash2 /></Button>
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove document?</DialogTitle><DialogDescription>{removing?.name}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button variant="destructive" loading={del.isPending} onClick={() => removing && del.mutate(removing.id, { onSuccess: () => { setRemoving(null); toast.success("Document removed"); }, onError: (e) => toast.error("Not removed", { description: errorText(e) }) })}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
