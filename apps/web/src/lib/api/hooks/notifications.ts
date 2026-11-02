"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { InboxOut, NotificationOut } from "../types";

export const notifKeys = { count: ["notifications", "count"] as const, inbox: (unreadOnly: boolean) => ["notifications", "inbox", unreadOnly] as const };

/** The bell: unread count, refreshed every 60 seconds. */
export const useNotificationCount = (enabled: boolean) =>
  useQuery({ queryKey: notifKeys.count, enabled: isLive && enabled, refetchInterval: 60_000, queryFn: () => api.get<{ unread: number }>("/notifications/unread-count") });

export const useInbox = (unreadOnly: boolean, enabled = true) =>
  useQuery({ queryKey: notifKeys.inbox(unreadOnly), enabled: isLive && enabled, refetchInterval: 60_000, queryFn: () => api.get<InboxOut>("/notifications", { unread_only: unreadOnly || undefined, limit: 50 }) });

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["notifications"] });
}
export const useMarkRead = () => { const refresh = useRefresh(); return useMutation({ mutationFn: (id: string) => api.post<NotificationOut>(`/notifications/${id}/read`), onSuccess: refresh }); };
export const useMarkAllRead = () => { const refresh = useRefresh(); return useMutation({ mutationFn: () => api.post<{ unread: number }>("/notifications/read-all"), onSuccess: refresh }); };
