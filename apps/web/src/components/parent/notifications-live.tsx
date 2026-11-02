"use client";
import * as React from "react";
import Link from "next/link";
import { Bell, BookOpen, CalendarCheck, CheckCheck, FileText, GraduationCap, Megaphone, MessageCircle, Star, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useChild } from "@/components/parent-child";
import { ErrorCard, LoadingCard, useErrText } from "@/components/parent/live-ui";
import { useParentInbox, useReadAllNotifs, useReadNotif } from "@/lib/api/hooks/parent-comms";
import { useFmt } from "@/lib/lang-context";
import { useT } from "@/lib/parent-i18n";
import { cn } from "@/lib/utils";

type Icon = React.ComponentType<{ className?: string }>;
const KINDS: Record<string, { icon: Icon; href: string }> = {
  attendance_present: { icon: CalendarCheck, href: "/parent/attendance" }, attendance_absent: { icon: CalendarCheck, href: "/parent/attendance" },
  attendance_first_half: { icon: CalendarCheck, href: "/parent/attendance" }, attendance_second_half: { icon: CalendarCheck, href: "/parent/attendance" },
  fee_reminder: { icon: Wallet, href: "/parent/fees" }, fee_payment: { icon: Wallet, href: "/parent/fees" }, fee_invoice: { icon: Wallet, href: "/parent/fees" },
  notice: { icon: Megaphone, href: "/parent/notices" }, broadcast: { icon: Megaphone, href: "/parent/notices" }, message: { icon: MessageCircle, href: "/parent/messages" },
  exam: { icon: FileText, href: "/parent/notices" }, result: { icon: FileText, href: "/parent/results" },
  leave_decided: { icon: CalendarCheck, href: "/parent/leave" }, leave_requested: { icon: CalendarCheck, href: "/parent/leave" },
  promotion_promoted: { icon: GraduationCap, href: "/parent" }, promotion_stayed: { icon: GraduationCap, href: "/parent" }, promotion_completed: { icon: GraduationCap, href: "/parent" },
  feedback: { icon: Star, href: "/parent/feedback" }, substitute_assigned: { icon: CalendarCheck, href: "/parent/timetable" },
  certificate_issued: { icon: FileText, href: "/parent/records" }, library_due: { icon: BookOpen, href: "/parent/records" },
};

export function NotificationsLive() {
  const t = useT(), f = useFmt(), err = useErrText();
  const sel = useChild();
  const q = useParentInbox(false, 100);
  const read = useReadNotif();
  const all = useReadAllNotifs();
  if (!sel) return null;
  const unread = q.data?.unread ?? 0;
  return (
    <>
      <PageHeader eyebrow={sel.child.name} title={t("nf.title")} dim={q.data ? (unread ? t("nf.new", { n: unread }) : t("nf.caught")) : undefined}
        actions={unread > 0 && <Button variant="secondary" loading={all.isPending} onClick={() => all.mutate(undefined, { onError: (e) => toast.error(err(e)) })}><CheckCheck /> {t("nf.markAll")}</Button>} />
      {q.data === undefined ? (q.isError ? <ErrorCard error={q.error} retry={() => void q.refetch()} fetching={q.isFetching} /> : <LoadingCard />) : (
        <Card className="p-2">
          {q.data.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("pl.noNotifications")}</p>}
          <ul>
            {q.data.items.map((n) => {
              const k = KINDS[n.kind]; const Icon = k?.icon ?? Bell;
              const kid = sel.children.length > 1 ? sel.children.find((c) => c.id === n.student_id) : null;
              const isRead = !!n.is_read;
              return (
                <li key={n.id}>
                  <Link href={k?.href ?? "/parent"} onClick={() => { if (!isRead) read.mutate(n.id); }} className="flex items-start gap-3 rounded-2xl p-3 hover:bg-card-hover">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-fill text-muted-foreground"><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2"><span className={cn("font-medium", !isRead && "font-bold")}>{n.title}</span>{!isRead && <i className="size-2 rounded-full bg-brand" role="img" aria-label={t("nf.unread")} />}{kid && <span className="rounded-full bg-fill px-2 py-0.5 text-[11px] text-muted-foreground">{kid.name.split(" ")[0]}</span>}</span>
                      <span className="block break-words text-sm text-muted-foreground">{n.body}</span>
                      <span className="mt-0.5 block text-xs tabular-nums text-text-tertiary">{f.ist(n.created_at)} IST</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
