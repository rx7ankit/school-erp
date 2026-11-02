"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { OwnerStats, Page, SchoolCreate, SchoolOut } from "../types";

export const ownerKeys = {
  schools: ["owner", "schools"] as const,
  school: (id: string) => ["owner", "schools", id] as const,
  stats: ["owner", "stats"] as const,
};

export const useOwnerSchools = () => useQuery({ queryKey: ownerKeys.schools, queryFn: ({ signal }) => api.get<Page<SchoolOut>>("/owner/schools", undefined, signal) });
export const useOwnerSchool = (id: string) => useQuery({ queryKey: ownerKeys.school(id), queryFn: ({ signal }) => api.get<SchoolOut>(`/owner/schools/${id}`, undefined, signal) });
export const useOwnerStats = () => useQuery({ queryKey: ownerKeys.stats, queryFn: ({ signal }) => api.get<OwnerStats>("/owner/stats", undefined, signal) });

function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["owner"] })]);
}

export function useCreateSchool() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (b: SchoolCreate) => api.post<SchoolOut>("/owner/schools", b), onSuccess: refresh });
}
export function useSetSchoolStatus(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (status: "active" | "suspended") => api.patch<SchoolOut>(`/owner/schools/${id}`, { status }), onSuccess: refresh });
}
export function useResendAdminLogin(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: () => api.post<{ sent: boolean }>(`/owner/schools/${id}/resend-admin-login`), onSuccess: refresh });
}
