"use client";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { BroadcastIn, BroadcastOut, DownloadOut, MessageOut, Page, StudentListItem, ThreadOut } from "../types";

export const msgKeys = {
  all: ["messaging"] as const,
  broadcasts: (scope: string, mine: boolean, offset: number) => ["messaging", "broadcasts", scope, mine, offset] as const,
  threads: (active: string) => ["messaging", "threads", active] as const,
  thread: (id: string) => ["messaging", "thread", id] as const,
  messages: (id: string) => ["messaging", "messages", id] as const,
  unread: ["messaging", "unread"] as const,
};
export const BROADCAST_PAGE = 20;
export const MESSAGE_PAGE = 50;

/** Unread thread messages for the sidebar badge. Polls once a minute while the tab is open. */
export const useUnreadMessages = (enabled: boolean) =>
  useQuery({ queryKey: msgKeys.unread, enabled: isLive && enabled, refetchInterval: 60_000, queryFn: () => api.get<{ messages: number }>("/messaging/unread-count") });

export const useBroadcasts = (scope: string, mine: boolean, offset: number) =>
  useQuery({
    queryKey: msgKeys.broadcasts(scope, mine, offset), enabled: isLive, placeholderData: keepPreviousData,
    queryFn: () => api.get<Page<BroadcastOut>>("/messaging/broadcasts", { scope: scope === "all" ? undefined : scope, mine: mine || undefined, limit: BROADCAST_PAGE, offset }),
  });
export const useSendBroadcast = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: BroadcastIn) => api.post<BroadcastOut>("/messaging/broadcasts", b), onSuccess: () => qc.invalidateQueries({ queryKey: ["messaging", "broadcasts"] }) });
};

export const useThreads = () =>
  useQuery({ queryKey: msgKeys.threads("all"), enabled: isLive, refetchInterval: 60_000, queryFn: () => api.get<Page<ThreadOut>>("/messaging/threads", { limit: 100 }) });
export const useThread = (id: string | null) =>
  useQuery({ queryKey: msgKeys.thread(id ?? ""), enabled: isLive && !!id, queryFn: () => api.get<ThreadOut>(`/messaging/threads/${id}`) });
/** Newest first. Polls while a conversation is open so a parent's reply shows up without a reload. */
export const useThreadMessages = (id: string | null) =>
  useQuery({ queryKey: msgKeys.messages(id ?? ""), enabled: isLive && !!id, refetchInterval: 15_000, queryFn: () => api.get<Page<MessageOut>>(`/messaging/threads/${id}/messages`, { limit: MESSAGE_PAGE }) });

export function useSendMessage(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { body: string; attachment_ids: string[] }) => api.post<MessageOut>(`/messaging/threads/${threadId}/messages`, v),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: msgKeys.messages(threadId) }), qc.invalidateQueries({ queryKey: ["messaging", "threads"] })]),
  });
}
export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/messaging/threads/${id}/read`),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["messaging", "threads"] }), qc.invalidateQueries({ queryKey: msgKeys.unread })]),
  });
}
export function useOpenThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { student_id: string; subject_id: string | null }) => api.post<ThreadOut>("/messaging/threads", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messaging", "threads"] }),
  });
}

/** Students of one class, to start a conversation about. */
export const useClassStudents = (classId: string) =>
  useQuery({ queryKey: ["messaging", "students", classId], enabled: isLive && !!classId, queryFn: () => api.get<Page<StudentListItem>>("/students", { class_id: classId, limit: 200 }) });

/** Opens an attachment: asks the API for a short-lived link, then opens it. */
export async function openAttachment(id: string) {
  const d = await api.get<DownloadOut>(`/messaging/files/${id}/url`);
  window.open(d.url, "_blank", "noopener");
}
