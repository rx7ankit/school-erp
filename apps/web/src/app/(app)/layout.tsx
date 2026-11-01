"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { useSession } from "@/components/session-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, parent, owner, ready } = useSession();
  const router = useRouter();
  React.useEffect(() => { if (ready && !user) router.replace(owner ? "/owner" : parent ? "/parent" : "/login"); }, [ready, user, parent, owner, router]);
  if (!ready || !user) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
