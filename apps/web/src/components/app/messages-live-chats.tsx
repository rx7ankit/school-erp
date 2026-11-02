"use client";
import * as React from "react";
import { ArrowLeft, Check, CheckCheck, Lock, MessageSquarePlus, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { AttachmentLink, ErrorBox, PickedFiles, uploadAll, useAttachments } from "@/components/app/messages-live-ui";
import { ClassTeacherTag, SubjectTag, UnreadDot } from "@/components/app/messages/bits";
import { ThreadRow } from "@/components/app/messages/thread-row";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useClasses, useSubjects } from "@/lib/api/hooks/academic";
import { useClassStudents, useMarkThreadRead, useOpenThread, useSendMessage, useThread, useThreadMessages, useThreads } from "@/lib/api/hooks/messaging";
import { errorText } from "@/lib/api/hooks/staff";
import type { MessageOut, Me, ThreadOut } from "@/lib/api/types";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";

const isClassTeacherTag = (t: ThreadOut) => t.tag === "Class teacher" && t.subject_id === null;

function Bubbles({ messages }: { messages: MessageOut[] }) {
  const end = React.useRef<HTMLDivElement>(null);
  const ordered = [...messages].reverse(); // the API sends newest first
  React.useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [ordered.length]);
  return (
    <ul className="flex max-h-[55dvh] min-h-48 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-label="Messages">
      {ordered.length === 0 && <li className="m-auto text-sm text-muted-foreground">No messages yet. Say hello below.</li>}
      {ordered.map((m) => (
        <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]", m.mine ? "items-end self-end" : "self-start")}>
          <div className={cn("flex flex-col gap-2 whitespace-pre-line break-words rounded-[20px] px-4 py-2.5 text-sm", m.mine ? "bg-solid text-on-solid" : "bg-fill")}>
            {m.body}
            {m.attachments.length > 0 && <span className="flex flex-wrap gap-1.5 text-foreground">{m.attachments.map((a) => <AttachmentLink key={a.id} a={a} />)}</span>}
          </div>
          <span className="flex items-center gap-1 text-[11px] text-text-tertiary">{formatIST(m.created_at)}{m.mine && (m.seen ? <><CheckCheck className="size-3 text-brand" /><span className="sr-only">Seen</span></> : <><Check className="size-3" /><span className="sr-only">Sent</span></>)}</span>
        </li>
      ))}
      <div ref={end} />
    </ul>
  );
}

function Reply({ thread }: { thread: ThreadOut }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const att = useAttachments();
  const send = useSendMessage(thread.id);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const attachment_ids = await uploadAll(att.files);
      await send.mutateAsync({ body, attachment_ids });
      setText(""); att.clear();
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border p-3">
      <PickedFiles files={att.files} remove={att.remove} />
      <div className="flex items-center gap-2">
        <input {...att.inputProps} />
        <Button type="button" variant="ghost" size="icon" aria-label="Attach files" onClick={att.pick} disabled={att.files.length >= 5}><Paperclip /></Button>
        <Input aria-label={`Message to the parent of ${thread.student_name}`} className="rounded-full" placeholder="Write to the parent" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="brand" size="icon" aria-label="Send" loading={busy} disabled={!text.trim()}><Send /></Button>
      </div>
    </form>
  );
}

function Conversation({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useThread(id);
  const m = useThreadMessages(id);
  const read = useMarkThreadRead();
  const unread = t.data?.unread ?? 0;
  const newest = m.data?.items[0]?.id;
  // Opening a thread, or a new message arriving while it is open, marks it read.
  React.useEffect(() => { if (unread > 0 && !read.isPending) read.mutate(id); }, [id, unread, newest]); // eslint-disable-line react-hooks/exhaustive-deps
  if (t.isPending) return <Card className="grid min-h-48 place-items-center text-sm text-muted-foreground">Loading…</Card>;
  if (t.isError) return <ErrorBox error={t.error} retry={() => t.refetch()} />;
  const th = t.data;
  return (
    <Card className="flex min-h-[460px] flex-col overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back" onClick={onBack}><ArrowLeft /></Button>
        <Avatar name={th.student_name} className="size-10" />
        <div className="min-w-0">
          <p className="truncate font-bold">{th.student_name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">{isClassTeacherTag(th) ? <ClassTeacherTag /> : <SubjectTag subject={th.tag} />}{th.class_label && <span className="text-xs text-text-tertiary">Class {th.class_label} · parent, private</span>}</div>
        </div>
      </div>
      {m.isPending ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : m.isError ? <div className="p-4"><ErrorBox error={m.error} retry={() => m.refetch()} /></div> : (
        <>
          {m.data.total > m.data.items.length && <p className="px-4 pt-3 text-center text-xs text-text-tertiary">Showing the latest {m.data.items.length} of {m.data.total} messages.</p>}
          <Bubbles messages={m.data.items} />
        </>
      )}
      {th.active ? <Reply thread={th} /> : (
        <div role="status" className="flex items-start gap-2.5 border-t border-border p-4 text-sm text-muted-foreground"><Lock className="mt-0.5 size-4 shrink-0" /><p>{th.inactive_notice ?? "This conversation is read-only."}</p></div>
      )}
    </Card>
  );
}

/** Pick a class, a student and (when you teach more than one thing there) the role, then open or reopen the thread. */
function NewThread({ me, open, onOpenChange, onOpened }: { me: Me; open: boolean; onOpenChange: (o: boolean) => void; onOpened: (id: string) => void }) {
  const classes = useClasses();
  const subjects = useSubjects();
  const [classRaw, setClass] = React.useState("");
  const [studentId, setStudent] = React.useState("");
  const [roleRaw, setRole] = React.useState("");
  const openThread = useOpenThread();
  const mineIds = [...new Set(me.assignments.map((a) => a.class_id))];
  const choices = (classes.data?.items ?? []).filter((c) => mineIds.includes(c.id));
  const classId = choices.some((c) => c.id === classRaw) ? classRaw : choices[0]?.id ?? "";
  const students = useClassStudents(classId);
  const list = students.data?.items ?? [];
  const sid = list.some((s) => s.id === studentId) ? studentId : list[0]?.id ?? "";
  // One entry per thing I am in this class: class teacher, and each subject I teach.
  const roles = me.assignments.filter((a) => a.class_id === classId).map((a) => ({ key: a.role === "class_teacher" ? "ct" : a.subject_id ?? "ct", subject_id: a.role === "class_teacher" ? null : a.subject_id ?? null, label: a.role === "class_teacher" ? "As class teacher" : `As ${subjects.data?.items.find((s) => s.id === a.subject_id)?.name ?? "subject"} teacher` }));
  const uniq = roles.filter((r, i) => roles.findIndex((x) => x.key === r.key) === i);
  const role = uniq.find((r) => r.key === roleRaw) ?? uniq[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New message</DialogTitle><DialogDescription>Write privately to the parent of a student in your class.</DialogDescription></DialogHeader>
        {classes.isError ? <ErrorBox error={classes.error} retry={() => classes.refetch()} /> : (
          <form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            if (!sid || !role) return;
            openThread.mutate({ student_id: sid, subject_id: role.subject_id }, { onSuccess: (t) => { onOpenChange(false); onOpened(t.id); } });
          }}>
            <Field label="Class" htmlFor="nt-class"><NativeSelect id="nt-class" value={classId} onChange={(e) => { setClass(e.target.value); setStudent(""); }}>{choices.map((c) => <option key={c.id} value={c.id}>Class {c.grade}-{c.section}</option>)}</NativeSelect></Field>
            <Field label="Student" htmlFor="nt-student">
              <NativeSelect id="nt-student" value={sid} onChange={(e) => setStudent(e.target.value)} disabled={students.isPending || list.length === 0}>
                {list.map((s) => <option key={s.id} value={s.id}>{s.name}{s.guardian_name ? ` · ${s.guardian_name}` : ""}</option>)}
              </NativeSelect>
              {students.isError ? <p className="text-xs text-destructive">{errorText(students.error)}</p> : !students.isPending && list.length === 0 && <p className="text-xs text-text-tertiary">No students in this class.</p>}
            </Field>
            {uniq.length > 1 && <Field label="Write as" htmlFor="nt-role"><NativeSelect id="nt-role" value={role?.key ?? ""} onChange={(e) => setRole(e.target.value)}>{uniq.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</NativeSelect></Field>}
            {openThread.isError && <p role="alert" className="text-sm text-destructive">{errorText(openThread.error)}</p>}
            <DialogFooter><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="brand" loading={openThread.isPending} disabled={!sid || !role}>Open conversation</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function LiveChats({ me }: { me: Me }) {
  const q = useThreads();
  const [active, setActive] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const canStart = me.assignments.length > 0;
  const items = q.data?.items ?? [];
  const sorted = [...items].sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
  const groups = [...new Set(sorted.map((t) => t.class_label ?? ""))];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr] lg:items-start">
      <Card className={cn("flex-col gap-1 p-2", active ? "hidden lg:flex" : "flex")}>
        <Button variant="secondary" size="sm" className="m-1 self-start" onClick={() => setNewOpen(true)} disabled={!canStart}><MessageSquarePlus /> New message</Button>
        {q.isPending ? <p className="p-3 text-sm text-muted-foreground">Loading…</p> : q.isError ? <div className="p-2"><ErrorBox error={q.error} retry={() => q.refetch()} /></div> : sorted.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{canStart ? "No conversations yet. Use New message to write to a parent." : "Chats are for teachers with a class. You have none assigned."}</p>
        ) : groups.map((g) => (
          <section key={g} aria-label={g ? `Class ${g}` : "Other"}>
            <h3 className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{g ? `Class ${g}` : "Other"}</h3>
            {sorted.filter((t) => (t.class_label ?? "") === g).map((t) => (
              <ThreadRow key={t.id} avatarName={t.student_name} title={t.student_name} subject={t.tag} classTeacher={isClassTeacherTag(t)}
                preview={t.last_message_preview ?? undefined} at={t.last_message_at ?? undefined} unread={t.unread > 0}
                inactiveNote={t.active ? undefined : "Read-only"} selected={active === t.id} onClick={() => setActive(t.id)} />
            ))}
          </section>
        ))}
      </Card>
      <div className={active ? "min-w-0" : "hidden min-w-0 lg:block"}>
        {active ? <Conversation key={active} id={active} onBack={() => setActive(null)} /> : <Card className="grid min-h-48 place-items-center text-sm text-muted-foreground">Choose a conversation</Card>}
      </div>
      <NewThread me={me} open={newOpen} onOpenChange={setNewOpen} onOpened={setActive} />
    </div>
  );
}
