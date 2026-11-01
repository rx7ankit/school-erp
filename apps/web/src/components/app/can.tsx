"use client";
import { useSession } from "@/components/session-provider";
import { hasAccess, type Access } from "@/lib/permissions";

/** Renders children only if the signed-in staff member has access. Admin always passes. */
export function Can({ access, classId, children, fallback = null }: {
  access: Access; classId?: string; children: React.ReactNode; fallback?: React.ReactNode;
}) {
  const { user } = useSession();
  return hasAccess(user, access, classId) ? <>{children}</> : <>{fallback}</>;
}

export function useCan() {
  const { user } = useSession();
  return (access: Access, classId?: string) => hasAccess(user, access, classId);
}
