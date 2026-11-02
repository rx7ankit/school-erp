"use client";
import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ThreadMessage } from "@/lib/messaging";
import { useFmt, useTr } from "@/lib/lang-context";
import { cn } from "@/lib/utils";
import { ClassTeacherTag, SubjectTag } from "./bits";

/** A conversation: header, bubbles (mine on the right), and a footer slot for the composer or a banner. */
export function ChatView({ title, subject, classTeacher, note, messages, viewer, onBack, children }: {
  title: string; subject: string; classTeacher?: boolean; note?: string; messages: ThreadMessage[]; viewer: "parent" | "staff";
  onBack?: () => void; children: React.ReactNode;
}) {
  const tr = useTr(), f = useFmt();
  const end = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  return (
    <Card className="flex min-h-[460px] flex-col overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-border p-4">
        {onBack && <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={tr("msg.back", "Back")} onClick={onBack}><ArrowLeft /></Button>}
        <Avatar name={title} className="size-10" />
        <div className="min-w-0">
          <p className="truncate font-bold">{title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">{classTeacher && <ClassTeacherTag />}<SubjectTag subject={subject} />{note && <span className="text-xs text-text-tertiary">{note}</span>}</div>
        </div>
      </div>
      <ul className="flex max-h-[55dvh] min-h-48 flex-1 flex-col gap-3 overflow-y-auto p-4" aria-label={tr("msg.list", "Messages")}>
        {messages.length === 0 && <li className="m-auto text-sm text-muted-foreground">{tr("msg.hello", "No messages yet. Say hello below.")}</li>}
        {messages.map((m) => {
          const mine = m.from === viewer;
          return (
            <li key={m.id} className={cn("flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]", mine ? "items-end self-end" : "self-start")}>
              <div className={cn("whitespace-pre-line break-words rounded-[20px] px-4 py-2.5 text-sm", mine ? "bg-solid text-on-solid" : "bg-fill")}>{m.body}</div>
              <span className="text-[11px] text-text-tertiary">{f.ist(m.at)}</span>
            </li>
          );
        })}
        <div ref={end} />
      </ul>
      {children}
    </Card>
  );
}
