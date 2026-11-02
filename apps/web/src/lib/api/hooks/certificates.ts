"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";
import type { Page } from "../types";

type S = components["schemas"];
export type CertificateOut = S["CertificateOut"];
export type CertificateIn = S["CertificateIn"];
export type CertificateKind = CertificateIn["kind"];
export type ReissueIn = S["ReissueIn"];

export const useCertificates = (studentId: string) =>
  useQuery({ queryKey: ["certificates", "student", studentId], enabled: isLive && !!studentId, placeholderData: keepPreviousData,
    queryFn: ({ signal }) => api.get<Page<CertificateOut>>("/certificates", { student_id: studentId, limit: 200 }, signal) });

function useCertMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  // Issuing a transfer certificate changes the student's status, so student data refreshes too.
  return useMutation({ mutationFn: fn, onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["certificates"] }), qc.invalidateQueries({ queryKey: ["students"] })]) });
}
export const useIssueCertificate = () => useCertMutation((b: CertificateIn) => api.post<CertificateOut>("/certificates", b));
export const useCancelCertificate = () => useCertMutation((v: { id: string; reason: string }) => api.post<CertificateOut>(`/certificates/${v.id}/cancel`, { reason: v.reason }));
export const useReissueCertificate = () => useCertMutation((v: { id: string } & ReissueIn) => { const { id, ...b } = v; return api.post<CertificateOut>(`/certificates/${id}/reissue`, b); });
