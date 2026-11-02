"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";

type S = components["schemas"];
export type FeedbackRow = S["FeedbackRow"];
export type FeedbackDetail = S["FeedbackDetail"];
export type TargetSummary = S["TargetSummary"];
export type MyFeedback = S["MyFeedbackRow"];

const KEY = ["feedback"] as const;

export const useFeedbackList = (enabled: boolean) => useQuery({ queryKey: [...KEY, "list"], enabled: isLive && enabled, queryFn: ({ signal }) => api.get<FeedbackRow[]>("/feedback", undefined, signal) });
export const useFeedback = (id: string) => useQuery({ queryKey: [...KEY, "one", id], enabled: isLive, queryFn: ({ signal }) => api.get<FeedbackDetail>(`/feedback/${id}`, undefined, signal) });
export const useMyFeedback = () => useQuery({ queryKey: [...KEY, "mine"], enabled: isLive, queryFn: ({ signal }) => api.get<MyFeedback[]>("/feedback/mine", undefined, signal) });

function useFeedbackMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
}
export const useCreateFeedback = () => useFeedbackMutation((b: { title: string; class_ids: string[]; opens_on?: string | null; closes_on: string; share_with_teachers: boolean; open_now: boolean }) => api.post<FeedbackRow>("/feedback", b));
export const useOpenFeedback = () => useFeedbackMutation((id: string) => api.post<FeedbackRow>(`/feedback/${id}/open`));
export const useCloseFeedback = () => useFeedbackMutation((id: string) => api.post<FeedbackRow>(`/feedback/${id}/close`));
