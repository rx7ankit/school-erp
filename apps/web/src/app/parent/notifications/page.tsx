"use client";
import * as React from "react";
import Link from "next/link";
import { Bell, CalendarCheck, CheckCheck, FileText, Megaphone, MessageCircle, Star, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { notifText, useNotifications, type NotifType } from "@/lib/notifications";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";

const ICON: Record<NotifType, React.ComponentType<{ className?: string }>> = {
  attendance_present: CalendarCheck, attendance_absent: CalendarCheck, attendance_first_half: CalendarCheck, attendance_second_half: CalendarCheck,
  fee_reminder: Wallet, notice: Megaphone, exam: FileText, result: FileText, feedback: Star, leave_approved: CalendarCheck, leave_rejected: CalendarCheck, report_card: FileText, broadcast: Megaphone, message: MessageCircle,
};
const HREF: Record<NotifType, string> = {
  attendance_present: "/parent/attendance", attendance_absent: "/parent/attendance", attendance_first_half: "/parent/attendance", attendance_second_half: "/parent/attendance",
  fee_reminder: "/parent/fees", notice: "/parent/notices", exam: "/parent/notices", result: "/parent/results", feedback: "/parent/feedback", leave_approved: "/parent/leave", leave_rejected: "/parent/leave", report_card: "/parent/results", broadcast: "/parent/messages", message: "/parent/messages",
};

export default function ParentNotifications() {
  const sel = useChild();
  const ids = sel ? sel.children.map((c) => c.id) : [];
  const { items, unread, markAllRead } = useNotifications(ids);
  if (!sel) return null;
  return (
    <>
      <PageHeader eyebrow={sel.child.name} title="Notifications." dim={unread ? `${unread} new` : "All caught up."}
        actions={unread > 0 && <Button variant="secondary" onClick={markAllRead}><CheckCheck /> Mark all read</Button>} />
      <Card className="p-2">
        {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">—</p>}
        <ul>
          {items.map((n) => {
            const Icon = ICON[n.type] ?? Bell; const x = notifText(n);
            const kid = sel.children.length > 1 ? sel.children.find((c) => c.id === n.studentId) : null;
            return (
              <li key={n.id}>
                <Link href={HREF[n.type]} className="flex items-start gap-3 rounded-2xl p-3 hover:bg-card-hover">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-fill text-muted-foreground"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className={cn("font-medium", !n.read && "font-bold")}>{x.title}</span>{!n.read && <i className="size-2 rounded-full bg-brand" aria-label="unread" />}{kid && <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] text-muted-foreground">{kid.name.split(" ")[0]}</span>}</span>
                    <span className="block text-sm text-muted-foreground">{x.body}</span>
                    <span className="mt-0.5 block text-xs tabular-nums text-text-tertiary">{formatIST(n.at)} IST</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
      <Link href="/parent" className="sr-only"><MessageCircle /></Link>
    </>
  );
}
