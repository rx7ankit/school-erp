"use client";
/** Parent portal: updates (notices and broadcasts), teacher threads and messages, notifications inbox. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";
import type { Page } from "../types";

type S = components["schemas"];
export type ParentFeedItem = S["FeedItemOut"];
export type ParentThread = S["ThreadOut"];
export type ParentMessage = S["MessageOut"];
export type ParentTeacher = S["TeacherOut"];
export type ParentNotification = S["NotificationOut"];
export type ParentInbox = S["InboxOut"];
export type ParentAttachment = S["AttachmentRef"];

const K = (...p: unknown[]) => ["parent", ...p];

/* ---- updates ---- */
export const useParentUpdates = (sid: string) =>
  useQuery({ queryKey: K("updates", sid), enabled: isLive && !!sid, queryFn: ({ signal }) => api.get<Page<ParentFeedItem>>("/parent/updates", { student_id: sid, limit: 100 }, signal) });
export const useParentUnread = () =>
  useQuery({ queryKey: K("unread"), enabled: isLive, refetchInterval: 60_000, queryFn: ({ signal }) => api.get<{ messages: number; updates: number }>("/parent/messaging/unread", undefined, signal) });

function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: K("updates") }), qc.invalidateQueries({ queryKey: K("unread") }), qc.invalidateQueries({ queryKey: K("threads") })]);
}
export const useReadUpdate = () => { const refresh = useRefresh(); return useMutation({ mutationFn: (id: string) => api.post(`/parent/updates/${id}/read`), onSuccess: refresh }); };
export const useReadAllUpdates = () => { const refresh = useRefresh(); return useMutation({ mutationFn: () => api.post("/parent/updates/read-all"), onSuccess: refresh }); };

/* ---- threads ---- */
export const useParentTeachers = (sid: string) =>
  useQuery({ queryKey: K("teachers", sid), enabled: isLive && !!sid, queryFn: ({ signal }) => api.get<ParentTeacher[]>(`/parent/children/${sid}/teachers`, undefined, signal) });
export const useParentThreads = (sid: string) =>
  useQuery({ queryKey: K("threads", sid), enabled: isLive && !!sid, refetchInterval: 30_000, queryFn: ({ signal }) => api.get<Page<ParentThread>>("/parent/threads", { student_id: sid, limit: 100 }, signal) });
export const useParentThread = (id: string | null) =>
  useQuery({ queryKey: K("thread", id), enabled: isLive && !!id, queryFn: ({ signal }) => api.get<ParentThread>(`/parent/threads/${id}`, undefined, signal) });
export const useParentMessages = (id: string | null) =>
  useQuery({ queryKey: K("messages", id), enabled: isLive && !!id, placeholderData: keepPreviousData, refetchInterval: 15_000, queryFn: ({ signal }) => api.get<Page<ParentMessage>>(`/parent/threads/${id}/messages`, { limit: 100 }, signal) });

export function useOpenParentThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { staff_id: string; student_id: string; subject_id: string | null }) => api.post<ParentThread>("/parent/threads", v),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: K("threads") }), qc.invalidateQueries({ queryKey: K("teachers") })]),
  });
}
export function useSendParentMessage(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { body: string; attachment_ids: string[] }) => api.post<ParentMessage>(`/parent/threads/${threadId}/messages`, b),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: K("messages", threadId) }), qc.invalidateQueries({ queryKey: K("threads") })]),
  });
}
export function useReadParentThread() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => api.post(`/parent/threads/${id}/read`), onSuccess: refresh });
}
export async function openParentAttachment(id: string) {
  const d = await api.get<{ url: string }>(`/parent/messaging/files/${id}/url`);
  window.open(d.url, "_blank", "noopener");
}

/* ---- notifications ---- */
export const useParentNotifCount = () =>
  useQuery({ queryKey: K("notif", "count"), enabled: isLive, refetchInterval: 60_000, queryFn: ({ signal }) => api.get<{ unread: number }>("/parent/notifications/unread-count", undefined, signal) });
export const useParentInbox = (unreadOnly = false, limit = 50) =>
  useQuery({ queryKey: K("notif", "inbox", unreadOnly, limit), enabled: isLive, refetchInterval: 60_000, queryFn: ({ signal }) => api.get<ParentInbox>("/parent/notifications", { unread_only: unreadOnly || undefined, limit }, signal) });
function useNotifRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: K("notif") });
}
export const useReadNotif = () => { const r = useNotifRefresh(); return useMutation({ mutationFn: (id: string) => api.post(`/parent/notifications/${id}/read`), onSuccess: r }); };
export const useReadAllNotifs = () => { const r = useNotifRefresh(); return useMutation({ mutationFn: () => api.post<{ unread: number }>("/parent/notifications/read-all"), onSuccess: r }); };
