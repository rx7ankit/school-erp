"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";
import type { Page } from "../types";

type S = components["schemas"];
export type PeriodOut = S["PeriodOut"];
export type PeriodIn = S["PeriodIn"];
export type SlotOut = S["SlotOut"];
export type ClassTimetable = S["ClassTimetable"];
export type StaffTimetable = S["StaffTimetable"];
export type MyDay = S["MyDay"];
export type DayEntry = S["DayEntry"];
export type AbsenceOut = S["AbsenceOut"];
export type CoverRow = S["CoverRow"];
export type FreeTeacher = S["FreeTeacher"];
export type SubstitutionOut = S["SubstitutionOut"];

const ALL = ["timetable"] as const;
const on = (key: unknown[], enabled = true) => ({ enabled: isLive && enabled, queryKey: [...ALL, ...key] });

export const usePeriods = () => useQuery({ ...on(["periods"]), queryFn: ({ signal }) => api.get<PeriodOut[]>("/timetable/periods", undefined, signal) });
export const useClassTimetable = (classId: string) => useQuery({ ...on(["class", classId], !!classId), queryFn: ({ signal }) => api.get<ClassTimetable>(`/timetable/classes/${classId}`, undefined, signal) });
export const useMyTimetable = () => useQuery({ ...on(["me"]), queryFn: ({ signal }) => api.get<StaffTimetable>("/timetable/me", undefined, signal) });
export const useStaffTimetable = (staffId: string) => useQuery({ ...on(["staff", staffId], !!staffId), queryFn: ({ signal }) => api.get<StaffTimetable>(`/timetable/staff/${staffId}`, undefined, signal) });
export const useMyDay = (day: string) => useQuery({ ...on(["me-day", day], !!day), queryFn: ({ signal }) => api.get<MyDay>("/timetable/me/day", { on: day }, signal) });

export const useAbsences = (day: string, enabled: boolean) => useQuery({ ...on(["absences", day], enabled && !!day), queryFn: ({ signal }) => api.get<Page<AbsenceOut>>("/timetable/absences", { on: day, limit: 200 }, signal) });
export const useCover = (day: string, enabled: boolean) => useQuery({ ...on(["cover", day], enabled && !!day), queryFn: ({ signal }) => api.get<CoverRow[]>("/timetable/cover", { on: day }, signal) });
export const useFreeTeachers = (day: string, periodId: string, enabled: boolean) =>
  useQuery({ ...on(["free", day, periodId], enabled && !!day && !!periodId), queryFn: ({ signal }) => api.get<FreeTeacher[]>("/timetable/free-teachers", { on: day, period_id: periodId }, signal) });

function useTimetableMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ALL }), qc.invalidateQueries({ queryKey: ["dashboard"] })]) });
}
export const useAddPeriod = () => useTimetableMutation((b: PeriodIn) => api.post<PeriodOut>("/timetable/periods", b));
export const useEditPeriod = () => useTimetableMutation((v: { id: string; body: Partial<PeriodIn> }) => api.patch<PeriodOut>(`/timetable/periods/${v.id}`, v.body));
export const useDeletePeriod = () => useTimetableMutation((id: string) => api.delete(`/timetable/periods/${id}`));

export interface NewSlot { class_id: string; weekday: number; period_id: string; subject_id: string; staff_id: string }
export const useAddSlot = () => useTimetableMutation((b: NewSlot) => api.post<SlotOut>("/timetable/slots", b));
export const useEditSlot = () => useTimetableMutation((v: { id: string; subject_id?: string; staff_id?: string }) => { const { id, ...b } = v; return api.patch<SlotOut>(`/timetable/slots/${id}`, b); });
export const useDeleteSlot = () => useTimetableMutation((id: string) => api.delete(`/timetable/slots/${id}`));

export const useMarkAbsent = () => useTimetableMutation((b: { staff_id: string; absent_on: string; reason?: string | null }) => api.post<AbsenceOut>("/timetable/absences", b));
export const useRemoveAbsence = () => useTimetableMutation((id: string) => api.delete(`/timetable/absences/${id}`));
export const useAssignSubstitute = () => useTimetableMutation((b: { slot_id: string; covers_on: string; substitute_staff_id: string }) => api.post<SubstitutionOut>("/timetable/substitutions", b));
export const useRemoveSubstitution = () => useTimetableMutation((id: string) => api.delete(`/timetable/substitutions/${id}`));
