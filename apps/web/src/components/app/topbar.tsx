"use client";
import { useRouter } from "next/navigation";
import { LogOut, Repeat } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/session-provider";
import { STAFF } from "@/lib/mock";
import { PERMISSION_LABELS } from "@/lib/permissions";
import { formatIST } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  const { user, signIn, signOut } = useSession();
  const router = useRouter();
  if (!user) return null;
  const roles = user.isAdmin ? ["Admin"] : user.permissions.map((p) => PERMISSION_LABELS[p]);
  if (!user.isAdmin && user.classes.some((c) => c.role === "class_teacher")) roles.push("Class teacher");
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-8">
      <p className="hidden text-sm text-muted-foreground sm:block" suppressHydrationWarning>{formatIST(new Date(), "weekday")} · IST</p>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
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
            <DropdownMenuLabel>Demo: view as</DropdownMenuLabel>
            {STAFF.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => { signIn(s.id); router.push("/dashboard"); }}>
                <Repeat /> <span className="flex-1 truncate">{s.name}</span><span className="text-xs text-text-tertiary">{s.designation.split(" ")[0]}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => { signOut(); router.push("/login"); }}><LogOut /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
