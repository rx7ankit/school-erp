"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LayoutDashboard, LogOut, Wallet } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/owner", label: "Overview", icon: LayoutDashboard },
  { href: "/owner/schools", label: "Schools", icon: Building2 },
  { href: "/owner/revenue", label: "Revenue", icon: Wallet },
];

/** Separate component so usePathname only runs after sign-in is confirmed (keeps dynamic routes prerenderable). */
function OwnerNav() {
  const path = usePathname();
  return (
    <nav aria-label="Owner" className="flex gap-1 overflow-x-auto lg:flex-col">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/owner" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-card", active && "bg-card text-foreground")}>
            <Icon className={cn("size-5", active && "text-brand")} strokeWidth={1.7} />{label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { owner, ready, user, parent, signOut } = useSession();
  const router = useRouter();
  React.useEffect(() => { if (ready && !owner) router.replace(user ? "/dashboard" : parent ? "/parent" : "/login"); }, [ready, owner, user, parent, router]);
  if (!ready || !owner) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-3 border-b border-border p-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:gap-6 lg:border-b-0 lg:border-r lg:p-5">
        <div className="flex items-center gap-3 px-1 lg:px-2"><Logo className="h-7" /><Badge tone="brand">Owner</Badge></div>
        <OwnerNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-8">
          <p className="text-sm text-muted-foreground">Platform owner · sample data</p>
          <div className="flex items-center gap-2"><ThemeToggle /><Button variant="secondary" onClick={() => { signOut(); router.push("/login"); }}><LogOut /> Sign out</Button></div>
        </div>
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
