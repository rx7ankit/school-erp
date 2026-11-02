"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Check, ChevronDown, KeyRound, LogOut } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/session-provider";
import { useChild } from "@/components/parent-child";
import { LanguageChooser, LanguageSwitch } from "@/components/parent-language";
import { useNotifications } from "@/lib/notifications";
import { useParentNotifCount } from "@/lib/api/hooks/parent-comms";
import { isLive } from "@/lib/api/config";
import { useLanguage, useT, type TKey } from "@/lib/parent-i18n";
import { ChangePasswordDialog } from "@/components/app/change-password-dialog";
import { cn } from "@/lib/utils";

const TABS: { href: string; key: TKey }[] = [
  { href: "/parent", key: "nav.home" }, { href: "/parent/attendance", key: "nav.attendance" }, { href: "/parent/results", key: "nav.results" },
  { href: "/parent/messages", key: "nav.messages" }, { href: "/parent/leave", key: "nav.leave" }, { href: "/parent/timetable", key: "nav.timetable" }, { href: "/parent/fees", key: "nav.fees" }, { href: "/parent/notices", key: "nav.notices" }, { href: "/parent/feedback", key: "nav.feedback" },
];
/** Certificates and library loans exist only on the real API; the demo has no data for them. */
const LIVE_TABS: { href: string; key: TKey }[] = [{ href: "/parent/records", key: "nav.records" }];

const bellCls = "relative grid size-10 place-items-center rounded-full bg-fill text-foreground hover:bg-separator";
function BellLink({ unread }: { unread: number }) {
  const t = useT();
  return <Link href="/parent/notifications" aria-label={unread ? t("hdr.notificationsNew", { n: unread }) : t("hdr.notifications")} className={bellCls}><Bell className="size-5" />{unread > 0 && <i className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-fill bg-brand" />}</Link>;
}
function DemoBell({ ids }: { ids: string[] }) { return <BellLink unread={useNotifications(ids).unread} />; }
function LiveBell() { return <BellLink unread={useParentNotifCount().data?.unread ?? 0} />; }

/** The parent portal frame: language chooser (first open), top bar, tabs. Inside the LanguageProvider. */
export function ParentShell({ children, fontClass }: { children: React.ReactNode; fontClass: string }) {
  const { parent, user, owner, ready, signOut } = useSession();
  const { lang, chosen, ready: langReady } = useLanguage();
  const t = useT();
  const sel = useChild();
  const [pwOpen, setPwOpen] = React.useState(false);
  const router = useRouter();
  const path = usePathname();
  React.useEffect(() => {
    if (!ready) return;
    if (!parent) router.replace(owner ? "/owner" : user ? "/dashboard" : "/login");
  }, [ready, parent, user, owner, router]);
  if (ready && parent && !sel) return (
    <div className="mx-auto grid min-h-dvh max-w-md content-center justify-items-start gap-4 px-4">
      <Logo className="h-8" /><h1 className="text-2xl font-bold">{t("pl.noChildrenTitle")}</h1><p className="text-sm text-muted-foreground">{t("pl.noChildrenText")}</p>
      <button type="button" className="h-10 cursor-pointer rounded-full bg-fill px-5 text-sm font-medium hover:bg-separator" onClick={() => { void signOut(); router.push("/login"); }}>{t("hdr.signOut")}</button>
    </div>
  );
  if (!ready || !parent || !sel) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">{t("app.loading")}</div>;
  const { child, children: kids, select } = sel;

  return (
    <div lang={lang === "hi" ? "hi-IN" : "en-IN"} className={cn("mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 pb-16 sm:px-6", lang === "hi" && fontClass)}>
      {langReady && !chosen && <LanguageChooser />}
      <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-2 bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:gap-3 sm:px-6">
        <DropdownMenu>
          <DropdownMenuTrigger disabled={kids.length < 2} aria-label={t("hdr.switchChild")} className="flex h-11 min-w-0 items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 text-left disabled:opacity-100 sm:gap-2.5 sm:pr-4">
            <Avatar name={child.name} className="size-9 shrink-0" />
            <span className="truncate text-sm font-bold">{child.name.split(" ")[0]}</span>
            <span className="shrink-0 text-xs text-text-tertiary">{child.classLabel}</span>
            {kids.length > 1 && <ChevronDown className="size-4 shrink-0 text-text-tertiary" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>{t("hdr.yourChildren")}</DropdownMenuLabel>
            {kids.map((k) => (
              <DropdownMenuItem key={k.id} onSelect={() => select(k.id)}>
                <Avatar name={k.name} className="size-7 text-[11px]" />
                <span className="flex-1"><span className="block font-medium">{k.name}</span><span className="block text-xs text-text-tertiary">{t("hdr.class", { c: k.classLabel })}</span></span>
                {k.id === child.id && <Check className="text-brand" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setPwOpen(true)}><KeyRound /> {t("hdr.changePassword")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { signOut(); router.push("/login"); }}><LogOut /> {t("hdr.signOut")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Logo className="hidden h-6 md:block" />
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2"><LanguageSwitch /><ThemeToggle />
          {isLive ? <LiveBell /> : <DemoBell ids={kids.map((c) => c.id)} />}</div>
      </header>

      <nav aria-label={t("nav.label")} className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
        {(isLive ? [...TABS, ...LIVE_TABS] : TABS).map((tab) => {
          const active = tab.href === "/parent" ? path === tab.href : path.startsWith(tab.href);
          return <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined}
            className={cn("flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-card", active && "bg-brand text-brand-foreground hover:bg-brand")}>{t(tab.key)}</Link>;
        })}
      </nav>
      <main className="flex flex-col gap-6" key={child.id}>{children}</main>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  );
}
