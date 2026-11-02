"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import { uploadFile } from "../download";
import type { components } from "../schema";
import type { Page } from "../types";

type S = components["schemas"];
export type FeeHead = S["HeadOut"];
export type FeeStructure = S["StructureOut"];
export type FeeRoute = S["RouteOut"];
export type FeeOption = S["OptionOut"];
export type FeeConcession = S["ConcessionOut"];
export type StudentConcession = S["StudentConcessionOut"];
export type LateRule = S["LateRuleOut"];
export type FeeSettings = S["SettingsOut"];
export type InvoiceRow = S["InvoiceRow"];
export type InvoiceDetail = S["InvoiceDetail"];
export type PaymentRow = S["PaymentOut"];
export type Receipt = S["Receipt"];
export type DuesReport = S["DuesReport"];
export type CollectionReport = S["CollectionReport"];
export type ReminderRow = S["ReminderRow"];
export type RunOut = S["RunOut"];
export type OpeningBalance = S["OpeningBalanceOut"];
export type OpeningImport = S["OpeningImportOut"];
export type FeeFrequency = "monthly" | "quarterly" | "term" | "yearly" | "once";
export type PayMode = "cash" | "cheque" | "upi" | "bank_transfer" | "online";

export const feeKeys = { all: ["fees"] as const, setup: ["fees", "setup"] as const };

export const FREQUENCY_LABEL: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", term: "Per term", yearly: "Yearly", once: "One time" };
export const MODE_NAME: Record<string, string> = { cash: "Cash", cheque: "Cheque", upi: "UPI", bank_transfer: "Bank transfer", online: "Online" };

type Q = Record<string, string | number | boolean | undefined | null>;
const get = <T,>(key: unknown[], path: string, params?: Q, enabled = true) =>
  useQuery({ queryKey: key, enabled: isLive && enabled, queryFn: ({ signal }) => api.get<T>(path, params, signal) });

/** A mutation that refreshes everything under "fees" (and the dashboard and analytics numbers) when it succeeds. */
function useFeeMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: feeKeys.all }), qc.invalidateQueries({ queryKey: ["dashboard"] }), qc.invalidateQueries({ queryKey: ["analytics"] })]),
  });
}

/* ---- money in ---- */
export interface InvoiceFilters { status?: string; q?: string; class_id?: string; period?: string; run_id?: string; limit: number; offset: number }
export const useInvoices = (f: InvoiceFilters) =>
  useQuery({ queryKey: [...feeKeys.all, "invoices", f], enabled: isLive, placeholderData: keepPreviousData, queryFn: ({ signal }) => api.get<Page<InvoiceRow>>("/fees/invoices", { ...f }, signal) });
export const useInvoice = (id: string | null) => get<InvoiceDetail>([...feeKeys.all, "invoice", id], `/fees/invoices/${id}`, undefined, !!id);
export const useReceipt = (id: string | null) => get<Receipt>([...feeKeys.all, "receipt", id], `/fees/payments/${id}`, undefined, !!id);

export interface PaymentFilters { date_from?: string; date_to?: string; mode?: string; status?: string; q?: string; limit: number; offset: number }
export const usePayments = (f: PaymentFilters) =>
  useQuery({ queryKey: [...feeKeys.all, "payments", f], enabled: isLive, placeholderData: keepPreviousData, queryFn: ({ signal }) => api.get<Page<PaymentRow>>("/fees/payments", { ...f }, signal) });

export const useRecordPayment = () => useFeeMutation((v: { invoiceId: string; amount_paise: number; mode: PayMode; reference?: string | null; note?: string | null }) => {
  const { invoiceId, ...b } = v; return api.post<Receipt>(`/fees/invoices/${invoiceId}/payments`, b);
});
export const useCancelPayment = () => useFeeMutation((v: { id: string; reason: string }) => api.post<Receipt>(`/fees/payments/${v.id}/cancel`, { reason: v.reason }));
export const useWaiveLateFee = () => useFeeMutation((v: { id: string; reason: string }) => api.post<InvoiceDetail>(`/fees/invoices/${v.id}/waive-late-fee`, { reason: v.reason }));

/* ---- reports and reminders ---- */
export const useDues = (f: { overdue_only?: boolean; class_id?: string; q?: string; limit: number; offset: number }) =>
  useQuery({ queryKey: [...feeKeys.all, "dues", f], enabled: isLive, placeholderData: keepPreviousData, queryFn: ({ signal }) => api.get<DuesReport>("/fees/reports/dues", { ...f }, signal) });
export const useCollection = (date_from: string, date_to: string, group_by: string) =>
  get<CollectionReport>([...feeKeys.all, "collection", date_from, date_to, group_by], "/fees/reports/collection", { date_from, date_to, group_by }, !!date_from && !!date_to);
export const useReminders = (overdue_only: boolean, enabled = true) => get<ReminderRow[]>([...feeKeys.all, "reminders", overdue_only], "/fees/reminders", { overdue_only }, enabled);
export const useSendReminders = () => useFeeMutation((b: { student_ids?: string[] | null; overdue_only?: boolean; email?: boolean }) => api.post<S["ReminderSendOut"]>("/fees/reminders/send", b));

/* ---- setup ---- */
export const useHeads = () => get<FeeHead[]>([...feeKeys.setup, "heads"], "/fees/heads");
export const useAddHead = () => useFeeMutation((b: { name: string; scope: "class" | "optional" }) => api.post<FeeHead>("/fees/heads", b));
export const useEditHead = () => useFeeMutation((v: { id: string; name?: string; is_active?: boolean }) => { const { id, ...b } = v; return api.patch<FeeHead>(`/fees/heads/${id}`, b); });

export const useStructures = (classId?: string) => get<FeeStructure[]>([...feeKeys.setup, "structures", classId ?? "all"], "/fees/structures", { class_id: classId });
export const useSetStructure = () => useFeeMutation((b: { class_id: string; fee_head_id: string; amount_paise: number; frequency: FeeFrequency }) => api.put<FeeStructure>("/fees/structures", b));
export const useDeleteStructure = () => useFeeMutation((id: string) => api.delete(`/fees/structures/${id}`));
export const useCopyStructure = () => useFeeMutation((b: { from_class_id: string; to_class_id: string }) => api.post<{ copied: number }>("/fees/structures/copy", b));

export const useRoutes = () => get<FeeRoute[]>([...feeKeys.setup, "routes"], "/fees/routes");
export const useAddRoute = () => useFeeMutation((b: { name: string; amount_paise: number }) => api.post<FeeRoute>("/fees/routes", b));
export const useEditRoute = () => useFeeMutation((v: { id: string; name?: string; amount_paise?: number; is_active?: boolean }) => { const { id, ...b } = v; return api.patch<FeeRoute>(`/fees/routes/${id}`, b); });

export const useStudentOptions = (studentId: string | null) => get<FeeOption[]>([...feeKeys.setup, "options", studentId], `/fees/students/${studentId}/options`, undefined, !!studentId);
export const useSetOption = () => useFeeMutation((v: { studentId: string; fee_head_id: string; route_id?: string | null; amount_paise?: number | null; frequency: FeeFrequency; note?: string | null }) => {
  const { studentId, ...b } = v; return api.put<FeeOption>(`/fees/students/${studentId}/options`, b);
});
export const useRemoveOption = () => useFeeMutation((v: { studentId: string; optionId: string }) => api.delete(`/fees/students/${v.studentId}/options/${v.optionId}`));

export const useConcessions = () => get<FeeConcession[]>([...feeKeys.setup, "concessions"], "/fees/concessions");
export const useAddConcession = () => useFeeMutation((b: { name: string; kind: "percent" | "fixed"; value: number; fee_head_id?: string | null }) => api.post<FeeConcession>("/fees/concessions", b));
export const useEditConcession = () => useFeeMutation((v: { id: string; name?: string; is_active?: boolean }) => { const { id, ...b } = v; return api.patch<FeeConcession>(`/fees/concessions/${id}`, b); });
export const useStudentConcessions = (studentId: string | null) => get<StudentConcession[]>([...feeKeys.setup, "student-concessions", studentId], `/fees/students/${studentId}/concessions`, undefined, !!studentId);
export const useAssignConcession = () => useFeeMutation((v: { studentId: string; concession_id: string; note?: string | null }) => { const { studentId, ...b } = v; return api.post<StudentConcession>(`/fees/students/${studentId}/concessions`, b); });
export const useRevokeConcession = () => useFeeMutation((v: { studentId: string; rowId: string }) => api.delete(`/fees/students/${v.studentId}/concessions/${v.rowId}`));

export const useLateRules = () => get<LateRule[]>([...feeKeys.setup, "late-rules"], "/fees/late-rules");
export const useSetLateRule = () => useFeeMutation((b: { grace_days: number; amount_paise: number; per: "once" | "day"; max_paise?: number | null }) => api.post<LateRule>("/fees/late-rules", b));
export const useApplyLateFees = () => useFeeMutation((b: { as_of?: string | null }) => api.post<S["LateApplyOut"]>("/fees/late-fees/apply", b));

export const useFeeSettings = () => get<FeeSettings>([...feeKeys.setup, "settings"], "/fees/settings");
export const useSaveFeeSettings = () => useFeeMutation((b: { auto_first_invoice: boolean; first_invoice_due_days: number }) => api.put<FeeSettings>("/fees/settings", b));

export const useRuns = () => get<RunOut[]>([...feeKeys.setup, "runs"], "/fees/invoice-runs", { limit: 20 });
export const useGenerateInvoices = () => useFeeMutation((b: { period_label: string; due_on: string; frequencies: FeeFrequency[]; class_ids?: string[] | null; carry_forward: boolean }) => api.post<RunOut>("/fees/invoice-runs", b));

export const useOpeningBalances = () => get<OpeningBalance[]>([...feeKeys.setup, "opening"], "/fees/opening-balances");
export const useSetOpeningBalance = () => useFeeMutation((b: { student_id: string; amount_paise: number; as_of_on: string; note?: string | null }) => api.put<OpeningBalance>("/fees/opening-balances", b));
export const useOpeningImportCheck = () => useFeeMutation((file: File) => uploadFile<OpeningImport>("/fees/opening-balances/import", file));
export const useOpeningImportCommit = () => useFeeMutation((v: { id: string; skip_errors: boolean }) => api.post<S["OpeningCommitOut"]>(`/fees/opening-balances/import/${v.id}/commit`, { skip_errors: v.skip_errors }));

/* ---- finding a student by name or scholar number (for options, concessions and opening balances) ---- */
export type StudentHit = S["StudentListItem"];
export const useStudentSearch = (q: string) =>
  useQuery({ queryKey: ["fees", "student-search", q], enabled: isLive && q.trim().length >= 2, queryFn: ({ signal }) => api.get<Page<StudentHit>>("/students", { q: q.trim(), limit: 8 }, signal) });
