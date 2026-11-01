"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, LogOut } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/session-provider";
import { useChild } from "@/components/parent-child";
import { className } from "@/lib/mock";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/parent", label: "Home" }, { href: "/parent/attendance", label: "Attendance" }, { href: "/parent/results", label: "Results" },
  { href: "/parent/messages", label: "Messages" }, { href: "/parent/fees", label: "Fees" }, { href: "/parent/notices", label: "Notices" },
];

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const { parent, user, owner, ready, signOut } = useSession();
  const sel = useChild();
  const router = useRouter();
  const path = usePathname();
  React.useEffect(() => {
    if (!ready) return;
    if (!parent) router.replace(owner ? "/owner" : user ? "/dashboard" : "/login");
  }, [ready, parent, user, owner, router]);
  if (!ready || !parent || !sel) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
  const { child, children: kids, select } = sel;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 pb-16 sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <DropdownMenu>
          <DropdownMenuTrigger disabled={kids.length < 2} aria-label="Switch child" className="flex h-11 items-center gap-2.5 rounded-full bg-card py-1 pl-1 pr-4 text-left disabled:opacity-100">
            <Avatar name={child.name} className="size-9" />
            <span className="text-sm font-bold">{child.name.split(" ")[0]}</span>
            <span className="text-xs text-text-tertiary">{className(child.classId)}</span>
            {kids.length > 1 && <ChevronDown className="size-4 text-text-tertiary" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Your children</DropdownMenuLabel>
            {kids.map((k) => (
              <DropdownMenuItem key={k.id} onSelect={() => select(k.id)}>
                <Avatar name={k.name} className="size-7 text-[11px]" />
                <span className="flex-1"><span className="block font-medium">{k.name}</span><span className="block text-xs text-text-tertiary">Class {className(k.classId)}</span></span>
                {k.id === child.id && <Check className="text-brand" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { signOut(); router.push("/login"); }}><LogOut /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Logo className="hidden h-6 sm:block" />
        <ThemeToggle />
      </header>

      <nav aria-label="Parent" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1">
        {TABS.map((t) => {
          const active = t.href === "/parent" ? path === t.href : path.startsWith(t.href);
          return <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-card", active && "bg-brand text-brand-foreground hover:bg-brand")}>{t.label}</Link>;
        })}
      </nav>
      <main className="flex flex-col gap-6" key={child.id}>{children}</main>
    </div>
  );
}
