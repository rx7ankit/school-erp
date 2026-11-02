"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { AssignmentRow, ClassOut, Page, StaffOut, SubjectOut, YearOut } from "../types";

/** Query keys. Everything about academic setup sits under "academic" so one invalidation refreshes it all. */
export const academicKeys = {
  all: ["academic"] as const,
  years: ["academic", "years"] as const,
  classes: (yearId?: string) => ["academic", "classes", yearId ?? "current"] as const,
  subjects: ["academic", "subjects"] as const,
  assignments: ["academic", "assignments"] as const,
  staff: ["staff", "list"] as const,
};

export const useYears = () => useQuery({ queryKey: academicKeys.years, enabled: isLive, queryFn: () => api.get<Page<YearOut>>("/academic/years") });

/** Classes of a year. Without a year id the API answers for the current year (409 no_current_year when there is none). */
export const useClasses = (yearId?: string) =>
  useQuery({ queryKey: academicKeys.classes(yearId), enabled: isLive, queryFn: () => api.get<Page<ClassOut>>("/academic/classes", { year_id: yearId }) });

export const useSubjects = () => useQuery({ queryKey: academicKeys.subjects, enabled: isLive, queryFn: () => api.get<Page<SubjectOut>>("/academic/subjects") });

export const useAssignmentRows = (enabled = true) =>
  useQuery({ queryKey: academicKeys.assignments, enabled: isLive && enabled, queryFn: () => api.get<Page<AssignmentRow>>("/academic/assignments") });

/** Needs the Staff permission on the API; a 403 reaches the screen as an ApiError. */
export const useStaffList = (enabled = true) =>
  useQuery({ queryKey: academicKeys.staff, enabled: isLive && enabled, queryFn: () => api.get<Page<StaffOut>>("/staff") });

/** A mutation that refreshes academic data (and the dashboard counts) when it succeeds. */
function useAcademicMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: academicKeys.all }), qc.invalidateQueries({ queryKey: ["dashboard"] })]),
  });
}

export const useAddYear = () => useAcademicMutation((b: { name: string; starts_on: string; ends_on: string }) => api.post<YearOut>("/academic/years", b));
export const useSetCurrentYear = () => useAcademicMutation((id: string) => api.post<YearOut>(`/academic/years/${id}/set-current`));

export interface NewClass { academic_year_id?: string; grade: string; section: string; capacity: number; is_custom?: boolean; display_order?: number }
export const useAddClass = () => useAcademicMutation((b: NewClass) => api.post<ClassOut>("/academic/classes", b));
export const useEditClass = () => useAcademicMutation((v: { id: string; section?: string; capacity?: number }) => { const { id, ...b } = v; return api.patch<ClassOut>(`/academic/classes/${id}`, b); });
export const useDeleteClass = () => useAcademicMutation((id: string) => api.delete(`/academic/classes/${id}`));

export const useAddSubject = () => useAcademicMutation((b: { name: string; code?: string | null }) => api.post<SubjectOut>("/academic/subjects", b));
export const useEditSubject = () => useAcademicMutation((v: { id: string; name: string; code?: string | null }) => { const { id, ...b } = v; return api.patch<SubjectOut>(`/academic/subjects/${id}`, b); });
export const useDeleteSubject = () => useAcademicMutation((id: string) => api.delete(`/academic/subjects/${id}`));

/** Replaces the whole subject list of one class. */
export const useSetClassSubjects = () => useAcademicMutation((v: { classId: string; subjectIds: string[] }) => api.put<ClassOut>(`/academic/classes/${v.classId}/subjects`, { subject_ids: v.subjectIds }));

export const useSetClassTeacher = () => useAcademicMutation((v: { classId: string; staffId: string | null }) => api.put(`/academic/classes/${v.classId}/class-teacher`, { staff_id: v.staffId }));
export const useSetSubjectTeacher = () => useAcademicMutation((v: { classId: string; subjectId: string; staffId: string | null }) => api.put(`/academic/classes/${v.classId}/subject-teachers/${v.subjectId}`, { staff_id: v.staffId }));

/** Shows an ApiError the way every form does: first field message when there is one, else the message. */
export function errorText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const fields = "fields" in e ? Object.values((e as { fields: Record<string, string> }).fields) : [];
    return fields[0] ?? String((e as { message: string }).message);
  }
  return "Something went wrong. Please try again.";
}
