"use client";
import * as React from "react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { markRead, sendThreadMessage, threadReadKey, threadsForChild, unreadCount, useMessaging, type ThreadInfo } from "@/lib/messaging";
import type { Student } from "@/lib/mock";
import { ChatView } from "./chat-view";
import { Composer } from "./composer";
import { InactiveBanner, LeftNote } from "./inactive-banner";
import { ThreadRow } from "./thread-row";
import { UpdatesFeed, UpdatesSummaryCard } from "./updates-feed";

const query = "(min-width: 1024px)";
const subscribeDesktop = (cb: () => void) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
/** True at lg and up, where the list and the open view sit side by side. */
const useDesktop = () => React.useSyncExternalStore(subscribeDesktop, () => window.matchMedia(query).matches, () => false);

type View = { kind: "updates" } | { kind: "thread"; key: string };

function ParentChat({ student, thread, onBack }: { student: Student; thread: ThreadInfo; onBack: () => void }) {
  const first = student.name.split(" ")[0];
  const count = thread.messages.length;
  React.useEffect(() => { markRead(threadReadKey("parent", thread.key)); }, [thread.key, count]);
  const inactive = thread.status === "inactive";
  const left = student.status !== "active";
  return (
    <ChatView title={thread.staffName} subject={thread.subject} classTeacher={thread.classTeacher} note={inactive ? "Previous teacher" : undefined} messages={thread.messages} viewer="parent" onBack={onBack}>
      {inactive ? <InactiveBanner teacher={thread.staffName} subject={thread.subject} child={first} />
        : left ? <LeftNote child={first} />
        : <Composer label={`Message to ${thread.staffName}`} placeholder={`Write to ${thread.staffName}`} onSend={(t) => sendThreadMessage(thread.key, "parent", t)} />}
    </ChatView>
  );
}

export function ParentMessages() {
  const sel = useChild();
  const { broadcasts, messages, reads } = useMessaging();
  const desktop = useDesktop();
  const [view, setView] = React.useState<{ childId: string; v: View } | null>(null);
  if (!sel) return null;
  const { child } = sel;
  // Remember the open view per child so switching child returns to the list.
  const picked = view && view.childId === child.id ? view.v : null;
  const current: View | null = picked ?? (desktop ? { kind: "updates" } : null);
  const open = (v: View | null) => setView(v ? { childId: child.id, v } : null);

  const threads = threadsForChild(child, messages);
  const active = threads.filter((t) => t.status === "active");
  const previous = threads.filter((t) => t.status === "inactive");
  const thread = current?.kind === "thread" ? threads.find((t) => t.key === current.key) : undefined;
  const left = child.status !== "active";
  const back = () => open(null);

  const detail = current?.kind === "updates" || (current && !thread)
    ? <UpdatesFeed key={child.id} student={child} broadcasts={broadcasts} reads={reads} onBack={back} />
    : thread ? <ParentChat key={thread.key} student={child} thread={thread} onBack={back} /> : null;

  return (
    <>
      <PageHeader eyebrow={child.name} title="Messages." dim="From your child's teachers." />
      {left && <p role="status" className="mt-5 rounded-2xl bg-fill px-4 py-3 text-sm text-muted-foreground">{child.name.split(" ")[0]} has left school. Messages are read-only.</p>}
      <div className="mt-6 grid gap-4 lg:grid-cols-[340px_1fr] lg:items-start">
        <div className={current ? "hidden flex-col gap-5 lg:flex" : "flex flex-col gap-5"}>
          <UpdatesSummaryCard student={child} broadcasts={broadcasts} reads={reads} selected={current?.kind === "updates"} onOpen={() => open({ kind: "updates" })} />
          <section aria-labelledby="teachers-h">
            <h2 id="teachers-h" className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Teachers</h2>
            <Card className="flex flex-col gap-0.5 p-2">
              {active.length === 0 && <p className="p-3 text-sm text-muted-foreground">No teachers are assigned to this class yet.</p>}
              {active.map((t) => (
                <ThreadRow key={t.key} avatarName={t.staffName} title={t.staffName} subject={t.subject} classTeacher={t.classTeacher}
                  preview={t.last ? `${t.last.from === "parent" ? "You: " : ""}${t.last.body}` : undefined} at={t.last?.at} unread={unreadCount(t, "parent", reads) > 0}
                  selected={current?.kind === "thread" && current.key === t.key} onClick={() => open({ kind: "thread", key: t.key })} />
              ))}
            </Card>
          </section>
          {previous.length > 0 && (
            <section aria-labelledby="prev-h">
              <h2 id="prev-h" className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Previous teachers</h2>
              <Card className="flex flex-col gap-0.5 p-2">
                {previous.map((t) => (
                  <ThreadRow key={t.key} avatarName={t.staffName} title={t.staffName} subject={t.subject} inactiveNote={`No longer teaches ${t.subject}`} at={t.last?.at}
                    selected={current?.kind === "thread" && current.key === t.key} onClick={() => open({ kind: "thread", key: t.key })} />
                ))}
              </Card>
            </section>
          )}
        </div>
        {current && <div className="min-w-0">{detail}</div>}
      </div>
    </>
  );
}
