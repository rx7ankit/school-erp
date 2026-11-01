"use client";
import * as React from "react";
import { ArrowLeft, Paperclip, Send, Users, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { NoAccess } from "@/components/app/no-access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSession } from "@/components/session-provider";
import { MESSAGES, THREADS, className } from "@/lib/mock";
import { hasAccess } from "@/lib/permissions";
import { formatIST, nowUTC } from "@/lib/time";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const { user } = useSession();
  const [active, setActive] = React.useState<string | null>(null);
  const [data, setData] = React.useState(MESSAGES);
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  if (!hasAccess(user, "assigned_class")) return <NoAccess need="a class assignment" />;

  // A teacher only sees threads of classes they are assigned to. Admin sees all.
  const threads = THREADS.filter((t) => user!.isAdmin || user!.classes.some((c) => c.classId === t.classId));
  const current = threads.find((t) => t.id === active);
  const msgs = current ? data[current.id] ?? [] : [];

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!current || (!text.trim() && !file)) return;
    setData((d) => ({ ...d, [current.id]: [...(d[current.id] ?? []), { id: crypto.randomUUID(), mine: true, from: "You", body: text.trim() || "Shared a file", at: nowUTC(), file: file?.name }] }));
    toast.success(current.kind === "class_group" ? `Sent to all parents of Class ${className(current.classId)}` : "Message sent");
    setText(""); setFile(null);
  }

  return (
    <>
      <PageHeader eyebrow="Parents" title="Messages." dim="Class groups and one-to-one." />
      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[320px_1fr]">
        <Card className={cn("flex flex-col gap-1 p-2", current && "hidden lg:flex")}>
          {threads.map((t) => (
            <button key={t.id} onClick={() => setActive(t.id)} className={cn("flex items-center gap-3 rounded-2xl p-3 text-left hover:bg-card-hover", active === t.id && "bg-fill")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-muted-foreground">{t.kind === "class_group" ? <Users className="size-4" /> : <User className="size-4" />}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2"><span className="truncate font-medium">{t.title}</span><span className="shrink-0 text-xs text-text-tertiary">{formatIST(t.lastAt, "short")}</span></span>
                <span className="block truncate text-[13px] text-muted-foreground">{t.last}</span>
              </span>
            </button>
          ))}
        </Card>
        <Card className={cn("flex flex-col p-0", !current && "hidden lg:flex")}>
          {current ? (
            <>
              <div className="flex items-center gap-3 border-b border-border p-4">
                <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Back" onClick={() => setActive(null)}><ArrowLeft /></Button>
                <div><p className="font-bold">{current.title}</p><p className="text-xs text-text-tertiary">{current.kind === "class_group" ? "All parents of this class see your messages" : "Private conversation"}</p></div>
              </div>
              <ul className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                {msgs.map((m) => (
                  <li key={m.id} className={cn("flex max-w-[80%] flex-col gap-1", m.mine ? "self-end items-end" : "self-start")}>
                    <div className={cn("rounded-[20px] px-4 py-2.5 text-sm", m.mine ? "bg-solid text-on-solid" : "bg-fill")}>
                      {m.body}
                      {m.file && <span className="mt-2 flex items-center gap-1.5 rounded-xl bg-white/15 px-2.5 py-1.5 text-xs"><Paperclip className="size-3.5" />{m.file}</span>}
                    </div>
                    <span className="text-[11px] text-text-tertiary">{!m.mine && `${m.from} · `}{formatIST(m.at, "datetime")}</span>
                  </li>
                ))}
              </ul>
              <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
                <input ref={fileRef} type="file" className="sr-only" aria-label="Attach material" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="secondary" size="icon" aria-label="Attach file" onClick={() => fileRef.current?.click()}><Paperclip /></Button>
                <Input aria-label="Message" className="rounded-full bg-background" placeholder={file ? file.name : "Write a message"} value={text} onChange={(e) => setText(e.target.value)} />
                <Button type="submit" variant="brand" size="icon" aria-label="Send"><Send /></Button>
              </form>
            </>
          ) : <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Choose a conversation</div>}
        </Card>
      </div>
    </>
  );
}
