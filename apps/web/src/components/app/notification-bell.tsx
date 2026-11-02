"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { Popover } from "radix-ui";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInbox, useMarkAllRead, useMarkRead, useNotificationCount } from "@/lib/api/hooks/notifications";
import { errorText } from "@/lib/api/hooks/staff";
import type { NotificationOut } from "@/lib/api/types";
import { isConnected } from "@/lib/features";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Where a notification leads, when that page exists in live mode. */
const ROUTE: Record<string, string> = { broadcast: "/messages", message: "/messages", leave_requested: "/leave", substitute_assigned: "/timetable" };

/** Live mode topbar bell: unread count (polled every 60 s) and a small inbox. */
export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const router = useRouter();
  const count = useNotificationCount(true);
  const inbox = useInbox(unreadOnly, open);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const unread = count.data?.unread ?? 0;

  function go(n: NotificationOut) {
    if (!n.is_read) markRead.mutate(n.id, { onError: (e) => toast.error(errorText(e)) });
    const href = ROUTE[n.kind];
    if (href && isConnected(href)) { setOpen(false); router.push(href); }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" size="icon" className="relative rounded-full" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
          <Bell />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold tabular-nums text-brand-foreground">{unread > 99 ? "99+" : unread}</span>}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 flex max-h-[min(560px,80dvh)] w-[min(400px,calc(100vw-2rem))] flex-col rounded-2xl border border-border bg-popover p-1.5">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="flex gap-1">
              {[false, true].map((u) => <Button key={String(u)} size="sm" variant={unreadOnly === u ? "default" : "ghost"} onClick={() => setUnreadOnly(u)}>{u ? "Unread" : "All"}</Button>)}
            </div>
            <Button size="sm" variant="ghost" loading={markAll.isPending} disabled={unread === 0} onClick={() => markAll.mutate(undefined, { onError: (e) => toast.error(errorText(e)) })}><CheckCheck /> Mark all read</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {inbox.isPending ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
              : inbox.isError ? (
                <div className="flex flex-col items-center gap-2 px-3 py-6 text-center text-sm text-destructive"><span>{errorText(inbox.error)}</span><Button size="sm" variant="secondary" onClick={() => inbox.refetch()}>Try again</Button></div>
              ) : inbox.data.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-sm text-muted-foreground"><BellOff className="size-5" />{unreadOnly ? "Nothing unread." : "No notifications yet."}</div>
              ) : (
                <ul>
                  {inbox.data.items.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => go(n)} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-card">
                        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-brand")}><span className="sr-only">{n.is_read ? "" : "Unread"}</span></span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm", n.is_read ? "font-medium" : "font-bold")}>{n.title}</span>
                          <span className="line-clamp-2 block text-[13px] text-muted-foreground">{n.body}</span>
                          <span className="mt-0.5 block text-[11px] tabular-nums text-text-tertiary">{formatIST(n.created_at)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
