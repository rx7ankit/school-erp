"use client";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Repeat } from "lucide-react";
import * as React from "react";
import { ChangePasswordDialog } from "./change-password-dialog";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/session-provider";
import { SCHOOL, STAFF } from "@/lib/mock";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { formatIST } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "./notification-bell";

export function Topbar() {
  const { user, signIn, signOut, live, me } = useSession();
  const router = useRouter();
  const [pwOpen, setPwOpen] = React.useState(false);
  if (!user) return null;
  const roles = user.isAdmin ? ["Admin"] : user.permissions.map((p) => PERMISSION_LABELS[p]);
  if (!user.isAdmin && user.classes.some((c) => c.role === "class_teacher")) roles.push("Class teacher");
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 py-3 backdrop-blur-xl sm:px-8 lg:px-10">
      <div className="hidden min-w-0 items-center gap-3 sm:flex">
        <span className="truncate text-sm font-semibold">{live ? me?.school?.name : SCHOOL.name}</span>
        <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-separator" />
        <p className="whitespace-nowrap text-sm text-text-tertiary" suppressHydrationWarning>{formatIST(new Date(), "weekday")} · IST</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {live && <NotificationBell />}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-10 items-center gap-3 rounded-full bg-card py-1 pl-1 pr-4 text-left" aria-label="Account menu">
            <Avatar name={user.name} className="size-8 bg-fill" />
            <span className="hidden text-sm font-medium sm:block">{user.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <div className="px-3 py-2">
              <p className="font-bold">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.designation}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{roles.length ? roles.map((r) => <Badge key={r} tone="brand">{r}</Badge>) : <Badge>Teacher</Badge>}</div>
            </div>
            <DropdownMenuSeparator />
            {!live && <>
            <DropdownMenuLabel>Demo: view as</DropdownMenuLabel>
            {STAFF.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => { signIn(s.id); router.push("/dashboard"); }}>
                <Repeat /> <span className="flex-1 truncate">{s.name}</span><span className="text-xs text-text-tertiary">{s.designation.split(" ")[0]}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            </>}
            <DropdownMenuItem onSelect={() => setPwOpen(true)}><KeyRound /> Change password</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { signOut(); router.push("/login"); }}><LogOut /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  );
}
