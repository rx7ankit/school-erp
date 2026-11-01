"use client";
import * as React from "react";
import { Paperclip, Send } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChild } from "@/components/parent-child";
import { BROADCASTS, MESSAGES, STAFF, className } from "@/lib/mock";
import { formatIST, nowUTC } from "@/lib/time";
import { usePending } from "@/lib/use-pending";
import { cn } from "@/lib/utils";

type Msg = { id: string; mine: boolean; from: string; body: string; at: string };

export default function ParentMessages() {
  const sel = useChild();
  const [sent, setSent] = React.useState<Record<string, Msg[]>>({});
  const [text, setText] = React.useState("");
  const { run, is } = usePending(500);
  if (!sel) return null;
  const { child } = sel;
  const left = child.status !== "active";
  const feed = BROADCASTS.filter((b) => b.classId === child.classId);
  const teacher = STAFF.find((s) => s.classes.some((c) => c.classId === child.classId && c.role === "class_teacher"));
  // Personal thread with the class teacher. Mine = parent here, so the sides are flipped from the staff view.
  const base = (MESSAGES["t3"] ?? []).map((m) => ({ ...m, mine: !m.mine }));
  const thread = [...base, ...(sent[child.id] ?? [])];

  return (
    <>
      <PageHeader eyebrow={child.name} title="Messages." dim="From your child's teachers." />
      <Tabs defaultValue="class">
        <TabsList><TabsTrigger value="class">Class</TabsTrigger><TabsTrigger value="personal">Personal</TabsTrigger></TabsList>
        <TabsContent value="class">
          <Card>
            {feed.length === 0 && <p className="text-sm text-muted-foreground">No class messages yet.</p>}
            <ul>
              {feed.map((b) => (
                <li key={b.id} className="flex flex-col gap-1.5 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{b.subject}</Badge><span className="text-sm text-muted-foreground">{b.sender}</span><span className="ml-auto text-xs tabular-nums text-text-tertiary">{formatIST(b.sentAt)}</span></div>
                  <p className="text-sm">{b.body}</p>
                  {b.file && <span className="flex w-fit items-center gap-1.5 rounded-full bg-fill px-3 py-1 text-xs"><Paperclip className="size-3.5" />{b.file}</span>}
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
        <TabsContent value="personal">
          <Card className="flex flex-col gap-4 p-0">
            <div className="border-b border-border p-4"><p className="font-bold">{teacher?.name ?? "Class teacher"}</p><p className="text-xs text-text-tertiary">Class teacher · {className(child.classId)}</p></div>
            <ul className="flex flex-col gap-3 px-4">
              {thread.map((m) => (
                <li key={m.id} className={cn("flex max-w-[80%] flex-col gap-1", m.mine ? "items-end self-end" : "self-start")}>
                  <div className={cn("rounded-[20px] px-4 py-2.5 text-sm", m.mine ? "bg-solid text-on-solid" : "bg-fill")}>{m.body}</div>
                  <span className="text-[11px] text-text-tertiary">{formatIST(m.at)}</span>
                </li>
              ))}
            </ul>
            {left ? <p className="border-t border-border p-4 text-sm text-muted-foreground">Messaging is off because {child.name.split(" ")[0]} has left school.</p> : (
              <form className="flex items-center gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; const body = text.trim(); run("send", () => { setSent((s) => ({ ...s, [child.id]: [...(s[child.id] ?? []), { id: crypto.randomUUID(), mine: true, from: "You", body, at: nowUTC() }] })); setText(""); }); }}>
                <Input aria-label="Message" className="rounded-full" placeholder="Write to the teacher" value={text} onChange={(e) => setText(e.target.value)} />
                <Button type="submit" variant="brand" size="icon" aria-label="Send" loading={is("send")}><Send /></Button>
              </form>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
