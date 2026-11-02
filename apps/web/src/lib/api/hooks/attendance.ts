"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";
import type { Page } from "../types";

type S = components["schemas"];
export type Sheet = S["Sheet"];
export type SheetStudent = S["SheetStudent"];
export type RecordIn = S["RecordIn"];
export type ClassStats = S["ClassStats"];
export type StudentStats = S["StudentStats"];
export type CalendarOut = S["Calendar"];
export type Analytics = S["Analytics"];
export type BelowRow = S["BelowRow"];
export type TeacherRow = S["TeacherRow"];
export type HolidayOut = S["HolidayOut"];
export type HolidayIn = S["HolidayIn"];
export type StaffMarkOut = S["StaffMarkOut"];
export type DaySummary = S["DaySummary"];

/** Everything about attendance sits under "attendance" so one invalidation refreshes it all. */
const ALL = ["attendance"] as const;
/** A period is a month ("2026-11") or empty for the academic year so far. */
export interface Period { month?: string }

export const useSheet = (classId: string, day: string) =>
  useQuery({ queryKey: [...ALL, "sheet", classId, day], enabled: isLive && !!classId && !!day, queryFn: ({ signal }) => api.get<Sheet>(`/attendance/classes/${classId}/sheet`, { day_on: day }, signal) });

export const useSaveDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { classId: string; day: string; records: RecordIn[] }) => api.put<Sheet>(`/attendance/classes/${v.classId}/days/${v.day}`, { records: v.records }),
    onSuccess: (sheet, v) => { qc.setQueryData([...ALL, "sheet", v.classId, v.day], sheet); return qc.invalidateQueries({ queryKey: [...ALL, "stats"] }).then(() => qc.invalidateQueries({ queryKey: [...ALL, "analytics"] })); },
  });
};

export const useClassStats = (classId: string, p: Period, threshold = 75) =>
  useQuery({ queryKey: [...ALL, "stats", classId, p.month ?? "", threshold], enabled: isLive && !!classId, placeholderData: keepPreviousData,
    queryFn: ({ signal }) => api.get<ClassStats>(`/attendance/classes/${classId}/stats`, { month: p.month, threshold }, signal) });

export const useStudentCalendar = (studentId: string | null, month: string) =>
  useQuery({ queryKey: [...ALL, "calendar", studentId, month], enabled: isLive && !!studentId && !!month, queryFn: ({ signal }) => api.get<CalendarOut>(`/attendance/students/${studentId}/calendar`, { month }, signal) });

export const useAnalytics = (p: Period, classId: string | undefined, threshold = 75) =>
  useQuery({ queryKey: [...ALL, "analytics", p.month ?? "", classId ?? "", threshold], enabled: isLive, placeholderData: keepPreviousData,
    queryFn: ({ signal }) => api.get<Analytics>("/attendance/analytics", { month: p.month, class_id: classId, threshold }, signal) });

export const useBelow = (p: Period, classId: string | undefined, threshold: number, offset: number, limit = 25) =>
  useQuery({ queryKey: [...ALL, "analytics", "below", p.month ?? "", classId ?? "", threshold, offset], enabled: isLive, placeholderData: keepPreviousData,
    queryFn: ({ signal }) => api.get<Page<BelowRow>>("/attendance/analytics/below", { month: p.month, class_id: classId, threshold, limit, offset }, signal) });

export const useTeacherWise = (p: Period) =>
  useQuery({ queryKey: [...ALL, "analytics", "teachers", p.month ?? ""], enabled: isLive, queryFn: ({ signal }) => api.get<TeacherRow[]>("/attendance/analytics/teachers", { month: p.month }, signal) });

export const useHolidays = () =>
  useQuery({ queryKey: [...ALL, "holidays"], enabled: isLive, queryFn: ({ signal }) => api.get<HolidayOut[]>("/holidays", undefined, signal) });

function useHolidayMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ALL }) });
}
export const useAddHoliday = () => useHolidayMutation((b: HolidayIn) => api.post<HolidayOut>("/holidays", b));
export const useEditHoliday = () => useHolidayMutation((v: { id: string; body: Partial<HolidayIn> }) => api.patch<HolidayOut>(`/holidays/${v.id}`, v.body));
export const useDeleteHoliday = () => useHolidayMutation((id: string) => api.delete(`/holidays/${id}`));

export const useStaffSheet = (day: string, enabled: boolean) =>
  useQuery({ queryKey: [...ALL, "staff", day], enabled: isLive && enabled && !!day, queryFn: ({ signal }) => api.get<StaffMarkOut[]>("/attendance/staff", { day_on: day }, signal) });
export const useSaveStaffDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { day: string; records: { staff_id: string; status: "present" | "absent" | "leave"; reason?: string | null }[] }) => api.put<StaffMarkOut[]>(`/attendance/staff/${v.day}`, { records: v.records }),
    onSuccess: (rows, v) => { qc.setQueryData([...ALL, "staff", v.day], rows); return qc.invalidateQueries({ queryKey: [...ALL, "analytics"] }); },
  });
};
