"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { AuditOut, Page } from "@/lib/api/types";

export interface AuditFilters {
  q?: string; category?: string; actor?: string; action?: string; sensitive?: boolean;
  date_from?: string; date_to?: string; limit: number; offset: number;
}

export function useAuditLog(f: AuditFilters) {
  return useQuery({
    queryKey: ["audit", "list", f],
    queryFn: ({ signal }) => api.get<Page<AuditOut>>("/audit", { ...f }, signal),
    placeholderData: keepPreviousData,
  });
}

export function useAuditOptions() {
  return useQuery({ queryKey: ["audit", "options"], queryFn: ({ signal }) => api.get<{ actors: string[]; actions: string[] }>("/audit/options", undefined, signal), staleTime: 60_000 });
}
