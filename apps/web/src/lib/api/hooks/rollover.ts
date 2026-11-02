"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";

type S = components["schemas"];
export type RolloverPlan = S["RolloverPlan"];
export type RolloverStatus = S["RolloverStatus"];
export type Readiness = S["Readiness"];
export type ClassPanel = S["ClassPanel"];
export type StudentHint = S["StudentHint"];
export type RolloverPreview = S["RolloverPreview"];
export type ApplyOut = S["ApplyOut"];
export type ChecklistItem = S["ChecklistItem"];
export type DraftOut = S["DraftOut"];
export type ApiDecision = "promote" | "repeat" | "leave" | "passed_out";

const q = <T>(key: string, path: string, extra = true) => ({ queryKey: ["rollover", key], enabled: isLive && extra, queryFn: () => api.get<T>(path) });

export const useRolloverStatus = (enabled = true) => useQuery(q<RolloverStatus>("status", "/rollover/status", enabled));
export const useReadiness = () => useQuery(q<Readiness>("readiness", "/rollover/readiness"));
export const useDraft = () => useQuery({ ...q<DraftOut>("draft", "/rollover/draft"), staleTime: 0, gcTime: 0 });
export const usePanels = () => useQuery({ ...q<ClassPanel[]>("students", "/rollover/students"), staleTime: 0 });
export const useChecklist = () => useQuery(q<ChecklistItem[]>("checklist", "/rollover/checklist"));

export function useSaveDraft() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (plan: RolloverPlan) => api.put<DraftOut>("/rollover/draft", plan), onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["rollover", "status"] }), qc.invalidateQueries({ queryKey: ["rollover", "students"] })]) });
}
export function useDiscardDraft() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.delete("/rollover/draft"), onSuccess: () => qc.invalidateQueries({ queryKey: ["rollover"] }) });
}
export const usePreview = () => useMutation({ mutationFn: (plan: RolloverPlan) => api.post<RolloverPreview>("/rollover/preview", plan) });
export function useApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { from_year_id: string; plan: RolloverPlan }) => api.post<ApplyOut>("/rollover/apply", { from_year_id: v.from_year_id, confirm: true, plan: v.plan }),
    onSuccess: () => Promise.all(["rollover", "academic", "students", "dashboard", "parents"].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}
