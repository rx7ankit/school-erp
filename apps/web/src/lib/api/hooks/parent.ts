"use client";
/** Parent portal: the child's records (children, attendance, fees, results, timetable, date sheet, leave, certificates). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";
import type { Page } from "../types";

type S = components["schemas"];
export type ParentChildOut = S["ChildOut"];
export type ParentCalendar = S["Calendar"];
export type ParentCalendarDay = S["CalendarDay"];
export type ParentStats = S["Stats"];
export type ParentHoliday = S["HolidayOut"];
export type ParentFees = S["StudentFees"];
export type ParentInvoiceRow = S["InvoiceRow"];
export type ParentInvoice = S["InvoiceDetail"];
export type ParentPayment = S["PaymentOut"];
export type ParentReceipt = S["Receipt"];
export type ParentExamRow = S["ParentExamRow"];
export type ParentResult = S["StudentResult"];
export type ParentLeave = S["LeaveOut"];
export type ParentTimetable = S["ChildTimetable"];
export type ParentSchedule = S["ParentSchedule"];
export type ParentCertificate = S["ParentCertificate"];

const K = (...p: unknown[]) => ["parent", ...p];
const useGet = <T,>(key: unknown[], path: string, params?: Record<string, string | number | boolean | undefined>, enabled = true) =>
  useQuery({ queryKey: K(...key), enabled: isLive && enabled, queryFn: ({ signal }) => api.get<T>(path, params, signal) });

export const useParentChildren = () => useGet<ParentChildOut[]>(["children"], "/parent/children");

export const useParentCalendar = (sid: string, month: string) =>
  useQuery({ queryKey: K("calendar", sid, month), enabled: isLive && !!sid && !!month, placeholderData: keepPreviousData, queryFn: ({ signal }) => api.get<ParentCalendar>(`/parent/children/${sid}/attendance/calendar`, { month }, signal) });

export const useParentFees = (sid: string) => useGet<ParentFees>(["fees", sid], `/parent/children/${sid}/fees`, undefined, !!sid);
export const useParentInvoice = (sid: string, id: string, enabled: boolean) => useGet<ParentInvoice>(["invoice", sid, id], `/parent/children/${sid}/fees/invoices/${id}`, undefined, enabled && !!sid);
export const fetchParentReceipt = (sid: string, paymentId: string) => api.get<ParentReceipt>(`/parent/children/${sid}/fees/receipts/${paymentId}`);

export const useParentResults = (sid: string) => useGet<ParentExamRow[]>(["results", sid], `/parent/children/${sid}/results`, undefined, !!sid);
export const useParentResult = (sid: string, examId: string, enabled: boolean) => useGet<ParentResult>(["result", sid, examId], `/parent/children/${sid}/results/${examId}`, undefined, enabled && !!sid);
export const useParentReportCard = (sid: string, examId: string) => useGet<S["ReportCard"]>(["reportcard", sid, examId], `/parent/children/${sid}/results/${examId}/report-card`, undefined, !!sid && !!examId);
export const fetchParentReportCard = (sid: string, examId: string) => api.get<S["ReportCard"]>(`/parent/children/${sid}/results/${examId}/report-card`);

export const useParentTimetable = (sid: string, on?: string) => useGet<ParentTimetable>(["timetable", sid, on ?? ""], `/parent/children/${sid}/timetable`, { on }, !!sid);
export const useParentDateSheet = (sid: string) => useGet<ParentSchedule[]>(["datesheet", sid], `/parent/children/${sid}/date-sheet`, undefined, !!sid);
export const useParentHolidays = (from_on?: string) => useGet<ParentHoliday[]>(["holidays", from_on ?? ""], "/parent/holidays", { from_on });

export const useParentCertificates = (sid: string) => useGet<ParentCertificate[]>(["certificates", sid], `/parent/children/${sid}/certificates`, undefined, !!sid);

/* ---- leave ---- */
export const useParentLeaves = (sid: string) => useQuery({ queryKey: K("leave", sid), enabled: isLive && !!sid, queryFn: ({ signal }) => api.get<Page<ParentLeave>>(`/parent/children/${sid}/leave`, { limit: 100 }, signal) });

export interface LeaveInput { from_on: string; to_on: string; half: "none" | "first" | "second"; reason: string; attachment_id?: string | null }
export function useApplyLeave(sid: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: LeaveInput) => api.post<ParentLeave>(`/parent/children/${sid}/leave`, b), onSuccess: () => qc.invalidateQueries({ queryKey: K("leave", sid) }) });
}
export function useCancelLeave(sid: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post<ParentLeave>(`/parent/leave/${id}/cancel`), onSuccess: () => qc.invalidateQueries({ queryKey: K("leave", sid) }) });
}
export async function openLeaveAttachment(id: string) {
  const d = await api.get<{ url: string }>(`/parent/leave/${id}/attachment-url`);
  window.open(d.url, "_blank", "noopener");
}

/** A medical note or similar: link, PUT to storage, confirm. Returns the file id. */
export async function uploadLeaveAttachment(file: File): Promise<string> {
  const slot = await api.post<{ id: string; upload_url: string; method?: string; headers: Record<string, string> }>("/parent/leave/attachments/upload-url",
    { filename: file.name, content_type: file.type || "application/octet-stream", size_bytes: file.size });
  let res: Response;
  try { res = await fetch(slot.upload_url, { method: slot.method || "PUT", headers: slot.headers, body: file }); }
  catch { throw new ApiError(0, "upload_failed", `Could not upload ${file.name}. Check your connection and try again.`); }
  if (!res.ok) throw new ApiError(res.status, "upload_failed", `Could not upload ${file.name}. Please try again.`);
  await api.post(`/parent/leave/attachments/${slot.id}/complete`);
  return slot.id;
}

/* ---- feedback ---- */
export type ParentFeedback = S["ParentFeedback"];
export const useParentFeedback = () => useGet<ParentFeedback[]>(["feedback"], "/parent/feedback");
export function useRateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { target_id: string; student_id: string; rating: number; comment: string }) =>
      api.put(`/parent/feedback/targets/${v.target_id}/children/${v.student_id}`, { rating: v.rating, comment: v.comment.trim() || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: K("feedback") }),
  });
}
