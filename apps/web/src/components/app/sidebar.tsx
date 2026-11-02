"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";
import { useSession } from "@/components/session-provider";
import { hasAccess } from "@/lib/permissions";
import { isConnected } from "@/lib/features";
import { SCHOOL } from "@/lib/mock";
import { Logo } from "./logo";
import { useUnreadMessages } from "@/lib/api/hooks/messaging";
import { cn } from "@/lib/utils";

function canOpen(user: Parameters<typeof hasAccess>[0], i: (typeof NAV)[number], live: boolean) {
  return hasAccess(user, i.access) || (live && !!i.liveAccess?.some((a) => hasAccess(user, a)));
}

export function Sidebar() {
  const { user, live, me } = useSession();
  const unread = useUnreadMessages(live && !!user && hasAccess(user, "assigned_class")).data?.messages ?? 0;
  const path = usePathname();
  const items = NAV.filter((i) => (live || !i.liveOnly) && canOpen(user, i, live) && isConnected(i.href));
  return (
    <aside className="flex shrink-0 flex-col gap-3 border-b border-border p-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:gap-6 lg:border-b-0 lg:border-r lg:p-5">
      <Link href="/dashboard" className="flex items-center gap-3 px-1 lg:px-2" aria-label="Krevo home">
        <Logo className="h-7" />
        <span className="hidden truncate text-xs text-text-tertiary lg:block">{live ? me?.school?.name : SCHOOL.name}</span>
      </Link>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-card",
                active && "bg-card text-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "text-foreground")} strokeWidth={1.7} />
              <span className="flex-1">{label}</span>
              {href === "/messages" && unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-solid px-1.5 text-[11px] font-bold tabular-nums text-on-solid" aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
