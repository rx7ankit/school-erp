"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { SkCard, SkPage, SkStatGrid, Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/components/session-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, parent, owner, ready } = useSession();
  const router = useRouter();
  React.useEffect(() => { if (ready && !user) router.replace(owner ? "/owner" : parent ? "/parent" : "/login"); }, [ready, user, parent, owner, router]);
  if (!ready || !user) return <ShellSkeleton />;
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}

/** The app shell while the session loads: sidebar column, top bar strip and a few content blocks. */
function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col gap-2 border-r border-border p-4 lg:flex" aria-hidden="true">
        <Skeleton className="mb-4 h-9 w-32 rounded-xl" />
        {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-10 rounded-full" />)}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center justify-between gap-3 border-b border-border px-4 sm:px-8" aria-hidden="true">
          <Skeleton className="h-9 w-40 rounded-full" />
          <div className="flex gap-2"><Skeleton className="size-10 rounded-full" /><Skeleton className="size-10 rounded-full" /></div>
        </div>
        <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <SkPage>
            <Skeleton className="h-9 w-48 rounded-xl sm:h-10 sm:w-60" />
            <SkStatGrid count={4} />
            <SkCard height={220} />
          </SkPage>
        </main>
      </div>
    </div>
  );
}
