"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import { downloadFile, postFile } from "../download";
import type { components } from "../schema";
import type { Page } from "../types";

type S = components["schemas"];
export type ParentRow = S["ParentRow"];
export type ParentSendOut = S["ParentSendOut"];
export type ParentListOut = S["ParentListOut"];
export type LoginFilter = "none" | "pending" | "sent" | "failed" | "active" | "waiting";
export interface ParentFilters { q?: string; login?: LoginFilter; limit?: number; offset?: number }

export const useParents = (f: ParentFilters) =>
  useQuery({ queryKey: ["parents", "list", f], enabled: isLive, placeholderData: keepPreviousData, queryFn: ({ signal }) => api.get<Page<ParentRow>>("/parents", { ...f }, signal) });

function useParentMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => Promise.all(["parents", "students"].map((k) => qc.invalidateQueries({ queryKey: [k] }))) });
}
/** No ids = everyone still waiting for a login. */
export const useSendParentLogins = () => useParentMutation((ids?: string[]) => (ids?.length === 1 ? api.post<ParentSendOut>(`/parents/${ids[0]}/send-login`) : api.post<ParentSendOut>("/parents/send-login", ids?.length ? { guardian_ids: ids } : {})));
export const useParentListLines = () => useParentMutation((v: { rows: S["ParentListRow"][]; dry_run: boolean; send_login: boolean }) => api.post<ParentListOut>("/parents/list-import", v));
export const useParentListFile = () => useParentMutation((v: { file: File; dry_run: boolean; send_login: boolean }) => postFile<ParentListOut>("/parents/list-import/file", v.file, { dry_run: v.dry_run, send_login: v.send_login }));
export const downloadParents = (f: ParentFilters) => downloadFile("/parents/export", { q: f.q, login: f.login }, "parents.xlsx");
