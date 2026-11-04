"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./nav";
import { useSession } from "@/components/session-provider";
import { hasAccess } from "@/lib/permissions";
import { isConnected } from "@/lib/features";
import { Logo } from "./logo";
import { useUnreadMessages } from "@/lib/api/hooks/messaging";
import { cn } from "@/lib/utils";

function canOpen(user: Parameters<typeof hasAccess>[0], i: (typeof NAV)[number], live: boolean) {
  return hasAccess(user, i.access) || (live && !!i.liveAccess?.some((a) => hasAccess(user, a)));
}

/** Sidebar sections. An item not listed here still shows, under the last section. */
const GROUPS: { title: string; hrefs: string[] }[] = [
  { title: "Overview", hrefs: ["/dashboard", "/analytics"] },
  { title: "People", hrefs: ["/classes", "/students", "/parents", "/staff"] },
  { title: "Daily", hrefs: ["/attendance", "/results", "/timetable", "/leave", "/messages"] },
  { title: "School", hrefs: ["/academic", "/promotion", "/feedback", "/fees", "/library"] },
  { title: "Admin", hrefs: ["/audit"] },
];

export function Sidebar() {
  const { user, live } = useSession();
  const unread = useUnreadMessages(live && !!user && hasAccess(user, "assigned_class")).data?.messages ?? 0;
  const path = usePathname();
  const items = NAV.filter((i) => (live || !i.liveOnly) && canOpen(user, i, live) && isConnected(i.href));
  const listed = new Set(GROUPS.flatMap((g) => g.hrefs));
  const groups = GROUPS.map((g, gi) => ({
    title: g.title,
    items: items.filter((i) => g.hrefs.includes(i.href) || (gi === GROUPS.length - 1 && !listed.has(i.href))),
  })).filter((g) => g.items.length > 0);
  return (
    <aside className="flex shrink-0 flex-col gap-3 border-b border-border p-4 lg:sticky lg:top-0 lg:h-dvh lg:w-[272px] lg:gap-4 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-5">
      <Link href="/dashboard" className="flex items-center gap-3 px-1 lg:px-2 lg:pt-1" aria-label="Krevo home">
        <Logo className="h-7" />
      </Link>
      <nav aria-label="Main" className="flex gap-1 overflow-x-auto lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-visible">
        {groups.map((g) => (
          <div key={g.title} className="flex gap-1 lg:flex-col lg:gap-0.5 lg:border-t lg:border-border lg:py-2 lg:first:border-t-0 lg:first:pt-0">
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = path === href || path.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-3 rounded-full px-3.5 text-sm font-medium transition-colors",
                    active ? "bg-solid text-on-solid" : "text-text-secondary hover:bg-card hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={active ? 2 : 1.7} />
                  <span className="flex-1">{label}</span>
                  {href === "/messages" && unread > 0 && <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums", active ? "bg-on-solid text-solid" : "bg-solid text-on-solid")} aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
