"use client";
import * as React from "react";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { markRead, sendThreadMessage, threadReadKey, threadsForChild, unreadCount, useMessaging, type ThreadInfo } from "@/lib/messaging";
import type { Student } from "@/lib/mock";
import { useData, useErrorText, useT } from "@/lib/parent-i18n";
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
  const t = useT(), errText = useErrorText();
  const first = student.name.split(" ")[0];
  const count = thread.messages.length;
  React.useEffect(() => { markRead(threadReadKey("parent", thread.key)); }, [thread.key, count]);
  const inactive = thread.status === "inactive";
  const left = student.status !== "active";
  return (
    <ChatView title={thread.staffName} subject={thread.subject} classTeacher={thread.classTeacher} note={inactive ? t("msg.prevTeacher") : undefined} messages={thread.messages} viewer="parent" onBack={onBack}>
      {inactive ? <InactiveBanner teacher={thread.staffName} subject={thread.subject} child={first} />
        : left ? <LeftNote child={first} />
        : <Composer label={t("msg.to", { name: thread.staffName })} placeholder={t("msg.write", { name: thread.staffName })} onSend={(text) => { const r = sendThreadMessage(thread.key, "parent", text); return r.ok ? r : { ok: false, error: errText(r.error) }; }} />}
    </ChatView>
  );
}

export function ParentMessages() {
  const t = useT(), d = useData();
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
      <PageHeader title={t("msg.title")} />
      {left && <p role="status" className="mt-5 rounded-2xl bg-fill px-4 py-3 text-sm text-muted-foreground">{t("pl.leftNote", { name: child.name.split(" ")[0] })}</p>}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr] lg:items-start">
        <div className={current ? "hidden min-w-0 flex-col gap-5 lg:flex" : "flex min-w-0 flex-col gap-5"}>
          <UpdatesSummaryCard student={child} broadcasts={broadcasts} reads={reads} selected={current?.kind === "updates"} onOpen={() => open({ kind: "updates" })} />
          <section aria-labelledby="teachers-h">
            <h2 id="teachers-h" className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{t("msg.teachers")}</h2>
            <Card className="flex flex-col gap-0.5 p-2">
              {active.length === 0 && <p className="p-3 text-sm text-muted-foreground">{t("msg.noTeachers")}</p>}
              {active.map((th) => (
                <ThreadRow key={th.key} avatarName={th.staffName} title={th.staffName} subject={th.subject} classTeacher={th.classTeacher}
                  preview={th.last ? `${th.last.from === "parent" ? t("msg.you") : ""}${th.last.body}` : undefined} at={th.last?.at} unread={unreadCount(th, "parent", reads) > 0}
                  selected={current?.kind === "thread" && current.key === th.key} onClick={() => open({ kind: "thread", key: th.key })} />
              ))}
            </Card>
          </section>
          {previous.length > 0 && (
            <section aria-labelledby="prev-h">
              <h2 id="prev-h" className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">{t("msg.previous")}</h2>
              <Card className="flex flex-col gap-0.5 p-2">
                {previous.map((th) => (
                  <ThreadRow key={th.key} avatarName={th.staffName} title={th.staffName} subject={th.subject} inactiveNote={t("msg.noLonger", { subject: d(th.subject) })} at={th.last?.at}
                    selected={current?.kind === "thread" && current.key === th.key} onClick={() => open({ kind: "thread", key: th.key })} />
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
