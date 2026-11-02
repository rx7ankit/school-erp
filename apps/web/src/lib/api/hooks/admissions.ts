"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import { downloadFile } from "../xfer";
import type { components } from "../schema";
import type { Page } from "../types";
import type { StudentDetail } from "./students";

type S = components["schemas"];
export type AdmissionOut = S["AdmissionOut"];
export type AdmissionIn = S["AdmissionIn"];
export type AdmissionStatus = "enquiry" | "applied" | "approved" | "rejected" | "enrolled";
export interface AdmissionFilters { status?: AdmissionStatus; q?: string; limit?: number; offset?: number }

export const useAdmissions = (f: AdmissionFilters) =>
  useQuery({ queryKey: ["admissions", "list", f], enabled: isLive, placeholderData: keepPreviousData, queryFn: ({ signal }) => api.get<Page<AdmissionOut>>("/admissions", { ...f }, signal) });

function useAdmissionMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => Promise.all(["admissions", "students", "parents", "academic", "dashboard"].map((k) => qc.invalidateQueries({ queryKey: [k] }))) });
}
export const useAddAdmission = () => useAdmissionMutation((b: AdmissionIn) => api.post<AdmissionOut>("/admissions", b));
export const useAdmissionStatus = () => useAdmissionMutation((v: { id: string; status: "enquiry" | "applied" | "approved" | "rejected"; note?: string }) => api.post<AdmissionOut>(`/admissions/${v.id}/status`, { status: v.status, note: v.note || undefined }));
export const useEnrolAdmission = () => useAdmissionMutation((v: { id: string; class_id?: string; send_login?: boolean; create_parent_login?: boolean }) => { const { id, ...b } = v; return api.post<StudentDetail>(`/admissions/${id}/enrol`, b); });
export const downloadAdmissions = (f: AdmissionFilters) => downloadFile("/admissions/export", { status: f.status, q: f.q }, "admissions.xlsx");
