"use client";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import { downloadFile, postFile, uploadToStorage } from "../xfer";
import type { components } from "../schema";
import type { Page } from "../types";

type S = components["schemas"];
export type StudentListItem = S["StudentListItem"];
export type StudentDetail = S["StudentDetail"];
export type GuardianOut = S["GuardianOut"];
export type EventOut = S["EventOut"];
export type EnrolIn = S["EnrolIn"];
export type StudentPatch = S["StudentPatch"];
export type DocumentOut = S["DocumentOut"];
export type ImportJobOut = S["ImportJobOut"];
export type ImportCommitOut = S["ImportCommitOut"];
export type GuardianAddIn = S["GuardianAddIn"];
export type StudentStatus = "active" | "left" | "tc_issued" | "passed_out" | "all";

export interface StudentFilters { q?: string; class_id?: string; status?: StudentStatus; limit?: number; offset?: number }

export const studentKeys = {
  all: ["students"] as const,
  list: (f: StudentFilters) => ["students", "list", f] as const,
  one: (id: string) => ["students", "one", id] as const,
  docs: (id: string) => ["students", "docs", id] as const,
};

export const useStudentList = (f: StudentFilters) =>
  useQuery({ queryKey: studentKeys.list(f), enabled: isLive, placeholderData: keepPreviousData, queryFn: ({ signal }) => api.get<Page<StudentListItem>>("/students", { ...f }, signal) });

export const useStudent = (id: string) => useQuery({ queryKey: studentKeys.one(id), enabled: isLive, queryFn: ({ signal }) => api.get<StudentDetail>(`/students/${id}`, undefined, signal) });

/** A student change also moves class counts, parents and the dashboard, so refresh them together. */
function useStudentMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(["students", "parents", "academic", "dashboard", "rollover"].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}

export const useEnrolStudent = () => useStudentMutation((b: EnrolIn) => api.post<StudentDetail>("/students", b));
export const useEditStudent = () => useStudentMutation((v: { id: string; body: StudentPatch }) => api.patch<StudentDetail>(`/students/${v.id}`, v.body));
export const useLeave = () => useStudentMutation((v: { id: string; reason: string; left_on?: string }) => api.post<StudentDetail>(`/students/${v.id}/leave`, { reason: v.reason, left_on: v.left_on || undefined }));
export const useRejoin = () => useStudentMutation((v: { id: string; class_id: string; reason?: string; on?: string }) => api.post<StudentDetail>(`/students/${v.id}/rejoin`, { class_id: v.class_id, reason: v.reason || undefined, on: v.on || undefined }));
export const useTransfer = () => useStudentMutation((v: { id: string; class_id: string; reason?: string; effective_on?: string }) => api.post<StudentDetail>(`/students/${v.id}/transfer`, { class_id: v.class_id, reason: v.reason || undefined, effective_on: v.effective_on || undefined }));
export const useAddGuardian = () => useStudentMutation((v: { id: string; body: GuardianAddIn }) => api.post<GuardianOut[]>(`/students/${v.id}/guardians`, v.body));
export const useEditGuardianLink = () => useStudentMutation((v: { id: string; guardianId: string; body: { relation?: string; is_primary?: boolean; is_emergency?: boolean } }) => api.patch<GuardianOut[]>(`/students/${v.id}/guardians/${v.guardianId}`, v.body));
export const useRemoveGuardian = () => useStudentMutation((v: { id: string; guardianId: string }) => api.delete<GuardianOut[]>(`/students/${v.id}/guardians/${v.guardianId}`));
export const useEditGuardian = () => useStudentMutation((v: { guardianId: string; body: { name?: string; phone?: string | null; email?: string | null; occupation?: string | null } }) => api.patch(`/parents/${v.guardianId}`, v.body));
export const useSendGuardianLogin = () => useStudentMutation((guardianId: string) => api.post<S["ParentSendOut"]>(`/parents/${guardianId}/send-login`));

/** Photo: presigned upload, confirm, then attach to the student. */
export const useSetPhoto = () => useStudentMutation(async (v: { id: string; file: File | null }) => {
  if (!v.file) return api.delete<StudentDetail>(`/students/${v.id}/photo`);
  const file_id = await uploadToStorage(v.file, "student_photo");
  return api.put<StudentDetail>(`/students/${v.id}/photo`, { file_id });
});

/* ---- documents (academic.manage only; each view is audited by the API) ---- */
export const DOC_KINDS = ["birth_certificate", "previous_tc", "id_proof", "photo", "other"] as const;
export const DOC_LABEL: Record<(typeof DOC_KINDS)[number], string> = { birth_certificate: "Birth certificate", previous_tc: "Previous school TC", id_proof: "ID proof", photo: "Photo", other: "Other" };
export const useStudentDocs = (id: string, enabled: boolean) => useQuery({ queryKey: studentKeys.docs(id), enabled: isLive && enabled, queryFn: () => api.get<DocumentOut[]>(`/students/${id}/documents`) });
export function useAddDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { file: File; kind: string; note?: string }) => {
      const attachment_id = await uploadToStorage(v.file, "student_document");
      return api.post<DocumentOut>(`/students/${id}/documents`, { kind: v.kind, attachment_id, note: v.note || undefined });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: studentKeys.docs(id) }),
  });
}
export function useDeleteDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (docId: string) => api.delete(`/students/${id}/documents/${docId}`), onSuccess: () => qc.invalidateQueries({ queryKey: studentKeys.docs(id) }) });
}
export const documentUrl = (id: string, docId: string) => api.get<{ url: string }>(`/students/${id}/documents/${docId}/url`);

/* ---- Excel import: dry run, then commit ---- */
export const useImportCheck = () => useMutation({ mutationFn: (v: { file: File; create_logins: boolean }) => postFile<ImportJobOut>("/students/import", v.file, { create_logins: v.create_logins }) });
export const useImportCommit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { jobId: string; skip_errors: boolean; send_login: boolean }) => api.post<ImportCommitOut>(`/students/import/${v.jobId}/commit`, { skip_errors: v.skip_errors, send_login: v.send_login }),
    onSuccess: () => Promise.all(["students", "parents", "academic", "dashboard"].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
};
export const downloadImportTemplate = () => downloadFile("/students/import/template", undefined, "students-import-template.xlsx");
export const downloadStudents = (f: StudentFilters) => downloadFile("/students/export", { q: f.q, class_id: f.class_id, status: f.status }, "students.xlsx");
