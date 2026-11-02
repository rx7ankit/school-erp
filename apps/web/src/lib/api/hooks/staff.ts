"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api/client";
import type { Page, Permission, StaffCreate, StaffOut, StaffPatch } from "@/lib/api/types";

export type SendLoginResult = { sent: number; failed: number };
export type BulkRow = { name: string; designation: string; email: string };

const KEY = ["staff"] as const;

/** One readable line from an API failure, with field messages when the API gave them. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    const f = Object.values(e.fields);
    return f.length ? `${e.message} ${f.join(" ")}` : e.message;
  }
  return "Something went wrong. Please try again.";
}

export function useStaffList(q: string) {
  return useQuery({ queryKey: [...KEY, "list", q], queryFn: ({ signal }) => api.get<Page<StaffOut>>("/staff", { q: q.trim() || undefined }, signal) });
}

function useStaffMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}

export const useAddStaff = () => useStaffMutation((b: StaffCreate) => api.post<StaffOut>("/staff", b));
export const useAddStaffBulk = () => useStaffMutation((b: { rows: BulkRow[]; send_login: boolean }) => api.post<Page<StaffOut>>("/staff/bulk", b));
export const useEditStaff = () => useStaffMutation((v: { id: string; body: StaffPatch }) => api.patch<StaffOut>(`/staff/${v.id}`, v.body));
export const useSetPermissions = () => useStaffMutation((v: { id: string; permissions: Permission[] }) => api.put<StaffOut>(`/staff/${v.id}/permissions`, { permissions: v.permissions }));
/** `ids` empty or missing sends to everyone still waiting for a first login. */
export const useSendLogin = () => useStaffMutation((ids?: string[]) => (ids?.length === 1 ? api.post<SendLoginResult>(`/staff/${ids[0]}/send-login`) : api.post<SendLoginResult>("/staff/send-login", ids?.length ? { user_ids: ids } : {})));
export const useRemoveStaff = () => useStaffMutation((id: string) => api.delete(`/staff/${id}`));
