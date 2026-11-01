"use client";
import * as React from "react";
import { ArrowLeft, Megaphone, Paperclip, Plus, Send, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { Field } from "@/components/app/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/session-provider";
import { BROADCASTS, CLASSES, MESSAGES, STUDENTS, SUBJECTS_ALL, THREADS, className, type Broadcast } from "@/lib/mock";
import { classIdsFor, hasAccess } from "@/lib/permissions";
import { formatIST, nowUTC } from "@/lib/time";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const { user } = useSession();
  const [broadcasts, setBroadcasts] = React.useState<Broadcast[]>(BROADCASTS);
  const [threads, setThreads] = React.useState(THREADS);
  const [data, setData] = React.useState(MESSAGES);
  const [active, setActive] = React.useState<string | null>(null);
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [bClass, setBClass] = React.useState("");
  const [bSubject, setBSubject] = React.useState("");
  const [bText, setBText] = React.useState("");
  const [bFile, setBFile] = React.useState<File | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const bFileRef = React.useRef<HTMLInputElement>(null);
  if (!user || !hasAccess(user, "assigned_class")) return <NoAccess need="a class assignment" />;

  const mine = classIdsFor(user, "assigned_class", CLASSES.map((c) => c.id));
  const classId = bClass || mine[0];
  // Class teacher may send general or any subject. A subject teacher only their own subject. Admin anything.
  const asg = user.classes.find((c) => c.classId === classId);
  const subjects = user.isAdmin || asg?.role === "class_teacher" ? ["General", ...SUBJECTS_ALL] : [asg?.subject ?? "General"];
  const subject = subjects.includes(bSubject) ? bSubject : subjects[0];
  const parentsCount = STUDENTS.filter((s) => s.classId === classId && s.status === "active").length;
  const myThreads = threads.filter((t) => mine.includes(t.classId));
  const current = myThreads.find((t) => t.id === active);

  function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!bText.trim()) return;
    setBroadcasts((b) => [{ id: crypto.randomUUID(), classId, subject, sender: user!.name, body: bText.trim(), sentAt: nowUTC(), file: bFile?.name }, ...b]);
    toast.success(`Sent to ${parentsCount} parents of Class ${className(classId)}`);
    setBText(""); setBFile(null);
  }
  function sendPersonal(e: React.FormEvent) {
    e.preventDefault();
    if (!current || (!text.trim() && !file)) return;
    setData((d) => ({ ...d, [current.id]: [...(d[current.id] ?? []), { id: crypto.randomUUID(), mine: true, from: "You", body: text.trim() || "Shared a file", at: nowUTC(), file: file?.name }] }));
    toast.success("Message sent"); setText(""); setFile(null);
  }
  function startThread(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const st = STUDENTS.find((s) => s.id === String(new FormData(e.currentTarget).get("student")))!;
    const id = crypto.randomUUID();
    setThreads((t) => [{ id, classId: st.classId, studentId: st.id, title: `${st.guardian} · parent of ${st.name.split(" ")[0]}`, last: "New conversation", lastAt: nowUTC() }, ...t]);
    setActive(id); setNewOpen(false);
  }
  const mineStudents = STUDENTS.filter((s) => mine.includes(s.classId) && s.status === "active");

  return (
    <>
      <PageHeader eyebrow="Parents" title="Messages." dim="Broadcast to a class or write to one parent." />
      <Tabs defaultValue="broadcast">
        <TabsList><TabsTrigger value="broadcast">Class broadcasts</TabsTrigger><TabsTrigger value="personal">Personal</TabsTrigger></TabsList>

        <TabsContent value="broadcast" className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader><CardTitle>New broadcast</CardTitle></CardHeader>
            <form onSubmit={sendBroadcast} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Class" htmlFor="bc"><NativeSelect id="bc" value={classId} onChange={(e) => setBClass(e.target.value)}>{mine.map((id) => <option key={id} value={id}>{className(id)}</option>)}</NativeSelect></Field>
                <Field label="Subject" htmlFor="bs"><NativeSelect id="bs" value={subject} onChange={(e) => setBSubject(e.target.value)}>{subjects.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
              </div>
              <Field label="Message" htmlFor="bt"><Textarea id="bt" value={bText} onChange={(e) => setBText(e.target.value)} placeholder="Homework, notes, study material..." /></Field>
              <input ref={bFileRef} type="file" className="sr-only" aria-label="Attach material" onChange={(e) => setBFile(e.target.files?.[0] ?? null)} />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => bFileRef.current?.click()}><Paperclip /> {bFile ? bFile.name : "Attach material"}</Button>
                <Button type="submit" variant="brand" className="ml-auto"><Megaphone /> Send to {parentsCount} parents</Button>
              </div>
              {user.classes.length > 0 && !user.isAdmin && asg?.role !== "class_teacher" && <p className="text-xs text-text-tertiary">You teach {asg?.subject} in this class, so you can broadcast for that subject.</p>}
            </form>
          </Card>
          <Card>
            <CardHeader><CardTitle>Sent</CardTitle></CardHeader>
            <ul className="flex flex-col">
              {broadcasts.filter((b) => mine.includes(b.classId)).map((b) => (
                <li key={b.id} className="flex flex-col gap-1.5 border-t border-border py-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{b.subject}</Badge><span className="text-sm text-muted-foreground">Class {className(b.classId)} · {b.sender}</span><span className="ml-auto text-xs tabular-nums text-text-tertiary">{formatIST(b.sentAt)}</span></div>
                  <p className="text-sm">{b.body}</p>
                  {b.file && <span className="flex w-fit items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-xs"><Paperclip className="size-3.5" />{b.file}</span>}
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="personal" className="grid min-h-[520px] gap-4 lg:grid-cols-[320px_1fr]">
          <Card className={cn("flex flex-col gap-1 p-2", current && "hidden lg:flex")}>
            <Button variant="secondary" size="sm" className="m-1 self-start" onClick={() => setNewOpen(true)}><Plus /> New message</Button>
            {myThreads.map((t) => (
              <button key={t.id} onClick={() => setActive(t.id)} className={cn("flex items-center gap-3 rounded-2xl p-3 text-left hover:bg-card-hover", active === t.id && "bg-fill")}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-muted-foreground"><User className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><span className="truncate font-medium">{t.title}</span><span className="shrink-0 text-xs text-text-tertiary">{formatIST(t.lastAt, "short")}</span></span>
                  <span className="block truncate text-[13px] text-muted-foreground">{t.last}</span></span>
              </button>
            ))}
          </Card>
          <Card className={cn("flex flex-col p-0", !current && "hidden lg:flex")}>
            {current ? (<>
              <div className="flex items-center gap-3 border-b border-border p-4">
                <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back" onClick={() => setActive(null)}><ArrowLeft /></Button>
                <div><p className="font-bold">{current.title}</p><p className="text-xs text-text-tertiary">Private. Only you and this parent see it.</p></div>
              </div>
              <ul className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                {(data[current.id] ?? []).map((m) => (
                  <li key={m.id} className={cn("flex max-w-[80%] flex-col gap-1", m.mine ? "items-end self-end" : "self-start")}>
                    <div className={cn("rounded-[20px] px-4 py-2.5 text-sm", m.mine ? "bg-solid text-on-solid" : "bg-fill")}>{m.body}
                      {m.file && <span className="mt-2 flex items-center gap-1.5 rounded-xl bg-white/15 px-2.5 py-1.5 text-xs"><Paperclip className="size-3.5" />{m.file}</span>}</div>
                    <span className="text-[11px] text-text-tertiary">{!m.mine && `${m.from} · `}{formatIST(m.at)}</span>
                  </li>
                ))}
              </ul>
              <form onSubmit={sendPersonal} className="flex items-center gap-2 border-t border-border p-3">
                <input ref={fileRef} type="file" className="sr-only" aria-label="Attach file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="secondary" size="icon" aria-label="Attach file" onClick={() => fileRef.current?.click()}><Paperclip /></Button>
                <Input aria-label="Message" className="rounded-full bg-background" placeholder={file ? file.name : "Write a message"} value={text} onChange={(e) => setText(e.target.value)} />
                <Button type="submit" variant="brand" size="icon" aria-label="Send"><Send /></Button>
              </form>
            </>) : <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Choose a conversation</div>}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Message a parent</DialogTitle></DialogHeader>
          <form onSubmit={startThread} className="flex flex-col gap-4">
            <Field label="Student" htmlFor="student" hint="The message goes to this child's parent login.">
              <NativeSelect id="student" name="student">{mineStudents.map((s) => <option key={s.id} value={s.id}>{s.name} · {className(s.classId)}</option>)}</NativeSelect>
            </Field>
            <DialogFooter><Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>Cancel</Button><Button type="submit" variant="brand">Start</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
