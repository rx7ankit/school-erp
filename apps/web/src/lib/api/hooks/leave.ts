"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";
import type { Page } from "../types";

export type LeaveOut = components["schemas"]["LeaveOut"];
export interface LeaveFilters { status?: string; class_id?: string; limit: number; offset: number }

export const useLeaveList = (f: LeaveFilters) =>
  useQuery({ queryKey: ["leave", "list", f], enabled: isLive, placeholderData: keepPreviousData, queryFn: ({ signal }) => api.get<Page<LeaveOut>>("/leave", { ...f }, signal) });

export const useDecideLeave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject"; note?: string }) => api.post<LeaveOut>(`/leave/${v.id}/decision`, { decision: v.decision, note: v.note?.trim() || null }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["leave"] }), qc.invalidateQueries({ queryKey: ["attendance", "sheet"] })]),
  });
};

export const fetchLeaveAttachment = (id: string) => api.get<{ url: string; expires_in?: number }>(`/leave/${id}/attachment-url`);
