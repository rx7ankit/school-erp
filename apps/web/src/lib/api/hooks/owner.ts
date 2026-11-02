"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { GenerateOut, MarkPaidIn, OwnerStats, Page, PlatformInvoiceOut, RevenueStats, SchoolCreate, SchoolOut } from "../types";

export const ownerKeys = {
  schools: ["owner", "schools"] as const,
  school: (id: string) => ["owner", "schools", id] as const,
  stats: ["owner", "stats"] as const,
  billingStats: ["owner", "billing", "stats"] as const,
  invoices: (f: InvoiceFilter, offset: number) => ["owner", "billing", "invoices", f, offset] as const,
};

export interface InvoiceFilter { school_id?: string; month?: string; status?: "due" | "paid"; overdue?: boolean }
export const INVOICE_PAGE = 25;
const invoiceParams = (f: InvoiceFilter) => ({ school_id: f.school_id, month: f.month, status: f.status, overdue: f.overdue || undefined });

export const useInvoices = (f: InvoiceFilter, offset: number) =>
  useQuery({ queryKey: ownerKeys.invoices(f, offset), placeholderData: keepPreviousData, queryFn: ({ signal }) => api.get<Page<PlatformInvoiceOut>>("/owner/billing/invoices", { ...invoiceParams(f), limit: INVOICE_PAGE, offset }, signal) });
export const useBillingStats = () => useQuery({ queryKey: ownerKeys.billingStats, queryFn: ({ signal }) => api.get<RevenueStats>("/owner/billing/stats", undefined, signal) });
export const invoiceExportParams = invoiceParams;

export const useOwnerSchools = () => useQuery({ queryKey: ownerKeys.schools, queryFn: ({ signal }) => api.get<Page<SchoolOut>>("/owner/schools", undefined, signal) });
export const useOwnerSchool = (id: string) => useQuery({ queryKey: ownerKeys.school(id), queryFn: ({ signal }) => api.get<SchoolOut>(`/owner/schools/${id}`, undefined, signal) });
export const useOwnerStats = () => useQuery({ queryKey: ownerKeys.stats, queryFn: ({ signal }) => api.get<OwnerStats>("/owner/stats", undefined, signal) });

function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["owner"] })]);
}

export function useCreateSchool() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (b: SchoolCreate) => api.post<SchoolOut>("/owner/schools", b), onSuccess: refresh });
}
export function useSetSchoolStatus(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (status: "active" | "suspended") => api.patch<SchoolOut>(`/owner/schools/${id}`, { status }), onSuccess: refresh });
}
export function useResendAdminLogin(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: () => api.post<{ sent: boolean }>(`/owner/schools/${id}/resend-admin-login`), onSuccess: refresh });
}
export function useGenerateInvoices() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (month?: string) => api.post<GenerateOut>("/owner/billing/invoices/generate", month ? { month } : {}), onSuccess: refresh });
}
export function useMarkInvoicePaid() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (v: { id: string; body: MarkPaidIn }) => api.post<PlatformInvoiceOut>(`/owner/billing/invoices/${v.id}/mark-paid`, v.body), onSuccess: refresh });
}
export function useSetSchoolPrice(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (price_per_student_paise: number) => api.patch<SchoolOut>(`/owner/schools/${id}`, { price_per_student_paise }), onSuccess: refresh });
}
