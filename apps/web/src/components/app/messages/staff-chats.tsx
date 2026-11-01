"use client";
import * as React from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { markRead, sendThreadMessage, threadReadKey, threadsForStaff, unreadCount, useMessaging, withMessages, type ThreadInfo } from "@/lib/messaging";
import { STUDENTS, className, type StaffRow } from "@/lib/mock";
import { ChatView } from "./chat-view";
import { Composer } from "./composer";
import { NewMessageDialog } from "./new-message-dialog";
import { ThreadRow } from "./thread-row";

function StaffChat({ thread, onBack }: { thread: ThreadInfo; onBack: () => void }) {
  const student = STUDENTS.find((s) => s.id === thread.studentId);
  const count = thread.messages.length;
  React.useEffect(() => { markRead(threadReadKey("staff", thread.key)); }, [thread.key, count]);
  return (
    <ChatView title={student?.name ?? "Student"} subject={thread.subject} classTeacher={thread.classTeacher} note={`Parent: ${student?.guardian ?? ""} · private`} messages={thread.messages} viewer="staff" onBack={onBack}>
      <Composer label={`Message to the parent of ${student?.name ?? "the student"}`} placeholder="Write to the parent" onSend={(t) => sendThreadMessage(thread.key, "staff", t)} />
    </ChatView>
  );
}

/** Chats tab: the teacher's own threads, grouped by class. Threads for classes or subjects they no longer have are not listed. */
export function StaffChats({ user }: { user: StaffRow }) {
  const { messages, reads } = useMessaging();
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const all = threadsForStaff(user.id, messages);
  const listed = withMessages(all).sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? ""));
  const classIds = [...new Set(listed.map((t) => t.classId))];
  const current = all.find((t) => t.key === activeKey);

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr] lg:items-start">
      <Card className={current ? "hidden flex-col gap-1 p-2 lg:flex" : "flex flex-col gap-1 p-2"}>
        <Button variant="secondary" size="sm" className="m-1 self-start" onClick={() => setNewOpen(true)} disabled={all.length === 0}><MessageSquarePlus /> New message</Button>
        {listed.length === 0 && <p className="p-3 text-sm text-muted-foreground">{all.length === 0 ? "Chats are for teachers with a class. You have none assigned." : "No conversations yet. Use New message to write to a parent."}</p>}
        {classIds.map((cid) => (
          <section key={cid} aria-label={`Class ${className(cid)}`}>
            <h3 className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Class {className(cid)}</h3>
            {listed.filter((t) => t.classId === cid).map((t) => {
              const s = STUDENTS.find((x) => x.id === t.studentId);
              return (
                <ThreadRow key={t.key} avatarName={s?.name ?? "?"} title={s?.name ?? "Student"} subtitle={s?.guardian} subject={t.subject} classTeacher={t.classTeacher}
                  preview={t.last ? `${t.last.from === "staff" ? "You: " : ""}${t.last.body}` : undefined} at={t.last?.at} unread={unreadCount(t, "staff", reads) > 0}
                  selected={activeKey === t.key} onClick={() => setActiveKey(t.key)} />
              );
            })}
          </section>
        ))}
      </Card>
      <div className={current ? "min-w-0" : "hidden min-w-0 lg:block"}>
        {current ? <StaffChat key={current.key} thread={current} onBack={() => setActiveKey(null)} />
          : <Card className="grid min-h-48 place-items-center text-sm text-muted-foreground">Choose a conversation</Card>}
      </div>
      <NewMessageDialog open={newOpen} onOpenChange={setNewOpen} threads={all} onStart={setActiveKey} />
    </div>
  );
}
