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
import { useLanguage, useT, type TKey } from "@/lib/parent-i18n";
import { ChangePasswordDialog } from "@/components/app/change-password-dialog";
import { className } from "@/lib/mock";
import { cn } from "@/lib/utils";

const TABS: { href: string; key: TKey }[] = [
  { href: "/parent", key: "nav.home" }, { href: "/parent/attendance", key: "nav.attendance" }, { href: "/parent/results", key: "nav.results" },
  { href: "/parent/messages", key: "nav.messages" }, { href: "/parent/leave", key: "nav.leave" }, { href: "/parent/timetable", key: "nav.timetable" }, { href: "/parent/fees", key: "nav.fees" }, { href: "/parent/notices", key: "nav.notices" }, { href: "/parent/feedback", key: "nav.feedback" },
];

/** The parent portal frame: language chooser (first open), top bar, tabs. Inside the LanguageProvider. */
export function ParentShell({ children, fontClass }: { children: React.ReactNode; fontClass: string }) {
  const { parent, user, owner, ready, signOut } = useSession();
  const { lang, chosen, ready: langReady } = useLanguage();
  const t = useT();
  const sel = useChild();
  const { unread } = useNotifications(sel ? sel.children.map((c) => c.id) : []);
  const [pwOpen, setPwOpen] = React.useState(false);
  const router = useRouter();
  const path = usePathname();
  React.useEffect(() => {
    if (!ready) return;
    if (!parent) router.replace(owner ? "/owner" : user ? "/dashboard" : "/login");
  }, [ready, parent, user, owner, router]);
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
            <span className="shrink-0 text-xs text-text-tertiary">{className(child.classId)}</span>
            {kids.length > 1 && <ChevronDown className="size-4 shrink-0 text-text-tertiary" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>{t("hdr.yourChildren")}</DropdownMenuLabel>
            {kids.map((k) => (
              <DropdownMenuItem key={k.id} onSelect={() => select(k.id)}>
                <Avatar name={k.name} className="size-7 text-[11px]" />
                <span className="flex-1"><span className="block font-medium">{k.name}</span><span className="block text-xs text-text-tertiary">{t("hdr.class", { c: className(k.classId) })}</span></span>
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
          <Link href="/parent/notifications" aria-label={unread ? t("hdr.notificationsNew", { n: unread }) : t("hdr.notifications")} className="relative grid size-10 place-items-center rounded-full bg-fill text-foreground hover:bg-separator"><Bell className="size-5" />{unread > 0 && <i className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-fill bg-brand" />}</Link></div>
      </header>

      <nav aria-label={t("nav.label")} className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
        {TABS.map((tab) => {
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
