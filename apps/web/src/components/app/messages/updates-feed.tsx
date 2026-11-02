"use client";
import * as React from "react";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GENERAL, SCHOOL_SUBJECT, lastReadAt, markRead, updatesFor, updatesReadKey, updatesUnread, type Broadcast } from "@/lib/messaging";
import type { Student } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { useData, useT } from "@/lib/parent-i18n";
import { useWhenShort } from "./bits";
import { BroadcastCard } from "./broadcast-card";

/** The pinned "Updates" row above the teacher list: latest item and unread count. */
export function UpdatesSummaryCard({ student, broadcasts, reads, selected, onOpen }: {
  student: Student; broadcasts: Broadcast[]; reads: Record<string, string>; selected: boolean; onOpen: () => void;
}) {
  const t = useT(), d = useData(), whenShort = useWhenShort();
  const latest = updatesFor(student, broadcasts)[0];
  const unread = updatesUnread(student, broadcasts, reads);
  return (
    <button type="button" onClick={onOpen} aria-current={selected || undefined}
      className={cn("flex w-full items-center gap-3 rounded-[20px] bg-card p-4 text-left hover:bg-card-hover", selected && "bg-fill")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground"><Megaphone className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2"><span className="font-bold">{t("upd.title")}</span>{latest && <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{whenShort(latest.sentAt)}</span>}</span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{latest ? `${latest.senderName}: ${d(latest.body)}` : t("upd.none")}</span>
          {unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold tabular-nums text-brand-foreground"><span className="sr-only">{t("upd.unread")}</span>{unread}</span>}
        </span>
      </span>
    </button>
  );
}

/** Unified feed: school notices and class broadcasts for the child, newest first, with filter chips. Parents cannot reply. */
export function UpdatesFeed({ student, broadcasts, reads, onBack }: { student: Student; broadcasts: Broadcast[]; reads: Record<string, string>; onBack?: () => void }) {
  const t = useT();
  const [filter, setFilter] = React.useState("all");
  // Unread markers stay for as long as the feed is open; the read mark moves forward on open.
  const [seenAt] = React.useState(() => lastReadAt(reads, updatesReadKey(student.id)));
  const all = updatesFor(student, broadcasts);
  React.useEffect(() => { markRead(updatesReadKey(student.id)); }, [student.id, all.length]);
  const subjects = [...new Set(all.map((b) => b.subject).filter((s) => s !== SCHOOL_SUBJECT && s !== GENERAL))].sort();
  const d = useData();
  const chips = [["all", t("upd.all")], ...(all.some((b) => b.subject === SCHOOL_SUBJECT) ? [[SCHOOL_SUBJECT, t("upd.school")]] : []), ...subjects.map((s) => [s, d(s)]), ...(all.some((b) => b.subject === GENERAL) ? [[GENERAL, t("upd.general")]] : [])];
  const shown = filter === "all" ? all : all.filter((b) => b.subject === filter);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {onBack && <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t("msg.back")} onClick={onBack}><ArrowLeft /></Button>}
        <div><h2 className="text-[17px] font-bold tracking-tight">{t("upd.title")}</h2><p className="text-xs text-text-tertiary">{t("upd.desc", { name: student.name.split(" ")[0] })}</p></div>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label={t("upd.filter")}>
        {chips.map(([v, label]) => (
          <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}
            className={cn("h-8 shrink-0 rounded-full px-4 text-sm font-medium", filter === v ? "bg-brand text-brand-foreground" : "bg-fill text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>
      {shown.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t("upd.empty")}</p> : (
        <ul className="flex flex-col">
          {shown.map((b) => (
            <li key={b.id} className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0"><BroadcastCard b={b} unread={b.sentAt > seenAt} /></li>
          ))}
        </ul>
      )}
    </Card>
  );
}
