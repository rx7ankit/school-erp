"use client";
import * as React from "react";
import { Megaphone, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { AttachmentLink, ErrorBox, PickedFiles, SubjectTag, uploadAll, useAttachments } from "@/components/app/messages-live-ui";
import { Pager } from "@/components/app/pager";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useClasses, useSubjects } from "@/lib/api/hooks/academic";
import { BROADCAST_PAGE, useBroadcasts, useSendBroadcast } from "@/lib/api/hooks/messaging";
import { errorText } from "@/lib/api/hooks/staff";
import type { BroadcastIn, BroadcastOut, Me } from "@/lib/api/types";
import { formatIST } from "@/lib/time";

type Scope = "class" | "all" | "grade" | "classes";
const GENERAL = "";

/** Compose a broadcast. Admin and academic managers: whole school, a grade, chosen classes or one class. Teachers: their own classes. */
export function LiveBroadcastForm({ me }: { me: Me }) {
  const manager = me.is_admin || me.permissions.includes("academic.manage");
  const classes = useClasses();
  const subjects = useSubjects();
  const send = useSendBroadcast();
  const att = useAttachments();
  const [scope, setScope] = React.useState<Scope>(manager ? "all" : "class");
  const [classRaw, setClass] = React.useState("");
  const [subjectRaw, setSubject] = React.useState(GENERAL);
  const [gradeRaw, setGrade] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const all = classes.data?.items ?? [];
  const mineIds = new Set(me.assignments.map((a) => a.class_id));
  const choices = manager ? all : all.filter((c) => mineIds.has(c.id));
  const label = (c: { grade: string; section: string }) => `Class ${c.grade}-${c.section}`;
  const classId = choices.some((c) => c.id === classRaw) ? classRaw : choices[0]?.id ?? "";
  const cls = choices.find((c) => c.id === classId);
  const grades = [...new Set(all.map((c) => c.grade))];
  const grade = grades.includes(gradeRaw) ? gradeRaw : grades[0] ?? "";

  // Class teacher and managers may tag any subject of the class (or General). A subject teacher only their own.
  const mine = me.assignments.filter((a) => a.class_id === classId);
  const free = manager || mine.some((a) => a.role === "class_teacher");
  const subjectList = subjects.data?.items ?? [];
  const options = free
    ? [{ id: GENERAL, name: "General" }, ...subjectList.filter((s) => cls?.subject_ids.includes(s.id))]
    : subjectList.filter((s) => mine.some((a) => a.subject_id === s.id));
  const subject = options.some((o) => o.id === subjectRaw) ? subjectRaw : options[0]?.id ?? GENERAL;

  const fields = error instanceof ApiError ? error.fields : {};
  const needsClass = scope === "class" ? !cls : scope === "classes" ? picked.length === 0 : scope === "grade" ? !grade : false;
  const disabled = !title.trim() || !body.trim() || needsClass;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setError(null); setBusy(true);
    try {
      const attachment_ids = await uploadAll(att.files);
      const payload: BroadcastIn = scope === "class"
        ? { scope: "class", audience: "all", class_id: classId, subject_id: subject || null, title: title.trim(), body: body.trim(), attachment_ids }
        : { scope: "school", audience: scope === "classes" ? "classes" : scope, grade: scope === "grade" ? grade : undefined, class_ids: scope === "classes" ? picked : [], title: title.trim(), body: body.trim(), attachment_ids };
      const out = await send.mutateAsync(payload);
      toast.success(`Sent to ${out.recipient_count} ${out.recipient_count === 1 ? "parent" : "parents"}`);
      setTitle(""); setBody(""); att.clear(); setPicked([]);
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  const scopes: [Scope, string][] = [...(manager ? [["all", "Whole school"], ["grade", "A grade"], ["classes", "Selected classes"]] as [Scope, string][] : []), ["class", manager ? "One class" : "My class"]];
  const err = (k: string) => fields[k] ? <p className="text-xs text-destructive">{fields[k]}</p> : null;

  return (
    <Card>
      <CardHeader><CardTitle>New broadcast</CardTitle></CardHeader>
      {classes.isError && <ErrorBox error={classes.error} retry={() => classes.refetch()} />}
      <form onSubmit={submit} className="flex flex-col gap-4">
        {scopes.length > 1 && (
          <Field label="Send to" htmlFor="bc-scope">
            <NativeSelect id="bc-scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>{scopes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
          </Field>
        )}
        {scope === "class" && (
          choices.length === 0 ? <p className="text-sm text-muted-foreground">{classes.isPending ? "Loading classes…" : "You have no class to write to."}</p> : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class" htmlFor="bc-class"><NativeSelect id="bc-class" value={classId} onChange={(e) => setClass(e.target.value)}>{choices.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}</NativeSelect></Field>
              <Field label="Subject" htmlFor="bc-subject"><NativeSelect id="bc-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</NativeSelect></Field>
            </div>
          )
        )}
        {scope === "grade" && (
          <Field label="Grade" htmlFor="bc-grade"><NativeSelect id="bc-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>{grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}</NativeSelect></Field>
        )}
        {scope === "classes" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Classes</legend>
            <div className="flex flex-wrap gap-2">
              {all.map((c) => (
                <label key={c.id} htmlFor={`bc-c-${c.id}`} className="flex h-9 items-center gap-2 rounded-full bg-fill px-3.5 text-sm">
                  <Checkbox id={`bc-c-${c.id}`} checked={picked.includes(c.id)} onCheckedChange={(on) => setPicked((p) => (on === true ? [...p, c.id] : p.filter((x) => x !== c.id)))} />{label(c)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {scope !== "class" && <p className="text-xs text-text-tertiary">Parents see this as a <strong className="font-medium text-foreground">School notice</strong>.</p>}
        <Field label="Title" htmlFor="bc-title"><Input id="bc-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="A short headline" />{err("title")}</Field>
        <Field label="Message" htmlFor="bc-body">
          <Textarea id="bc-body" value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} placeholder={scope === "class" ? "Homework, notes, study material..." : "Notice for parents"} />{err("body")}
        </Field>
        <input {...att.inputProps} />
        <PickedFiles files={att.files} remove={att.remove} />
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={att.pick} disabled={att.files.length >= 5}><Paperclip /> Attach files</Button>
        <p className="-mt-2 text-xs text-text-tertiary">Images or PDF, up to 5 files of 10 MB.</p>
        {error != null && <p role="alert" className="text-sm text-destructive">{errorText(error)}</p>}
        <div className="flex justify-end"><Button type="submit" variant="brand" loading={busy} disabled={disabled}><Megaphone /> Send</Button></div>
      </form>
    </Card>
  );
}

function ScopeChips({ b }: { b: BroadcastOut }) {
  if (b.audience === "all") return <Badge>Whole school</Badge>;
  if (b.audience === "grade") return <Badge>Grade {b.grade}</Badge>;
  return <>{b.class_labels.map((l) => <Badge key={l}>Class {l.replace(/^Class\s*/i, "")}</Badge>)}</>;
}

function BroadcastCard({ b }: { b: BroadcastOut }) {
  return (
    <article className="flex gap-3" aria-label={`${b.title} from ${b.sender_name}`}>
      <Avatar name={b.sender_name} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-bold">{b.sender_name}</span>
          <SubjectTag subject={b.tag} />
          <ScopeChips b={b} />
          <span className="ml-auto text-xs tabular-nums text-text-tertiary">{formatIST(b.created_at)}</span>
        </div>
        <p className="font-medium">{b.title}</p>
        <p className="whitespace-pre-line break-words text-sm">{b.body}</p>
        {b.attachments.length > 0 && <div className="flex flex-wrap gap-2">{b.attachments.map((a) => <AttachmentLink key={a.id} a={a} />)}</div>}
        <p className="text-xs text-text-tertiary tabular-nums">Reached {b.recipient_count} {b.recipient_count === 1 ? "parent" : "parents"} · {b.read_count} read</p>
      </div>
    </article>
  );
}

/** Sent broadcasts, newest first, with how many parents were reached and how many opened each. */
export function LiveBroadcastList() {
  const [scope, setScope] = React.useState("all");
  const [mine, setMine] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const q = useBroadcasts(scope, mine, page * BROADCAST_PAGE);
  const total = q.data?.total ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sent</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          {[["all", "All"], ["school", "School"], ["class", "Class"]].map(([v, l]) => <Button key={v} size="sm" variant={scope === v ? "default" : "secondary"} onClick={() => { setScope(v); setPage(0); }}>{l}</Button>)}
          <Button size="sm" variant={mine ? "default" : "secondary"} aria-pressed={mine} onClick={() => { setMine(!mine); setPage(0); }}>Mine</Button>
        </div>
      </CardHeader>
      {q.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : q.isError ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : q.data.items.length === 0 ? <p className="text-sm text-muted-foreground">No broadcasts yet.</p> : (
        <>
          <ul className="flex flex-col">
            {q.data.items.map((b) => <li key={b.id} className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"><BroadcastCard b={b} /></li>)}
          </ul>
          <Pager page={page} pages={Math.max(1, Math.ceil(total / BROADCAST_PAGE))} total={total} size={BROADCAST_PAGE} setPage={setPage} />
        </>
      )}
    </Card>
  );
}
