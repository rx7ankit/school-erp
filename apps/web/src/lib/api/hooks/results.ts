"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";
import type { Page } from "../types";

type S = components["schemas"];
export type Scheme = S["SchemeOut"];
export type Exam = S["ExamOut"];
export type Paper = S["PaperOut"];
export type ExamClassStatus = S["ExamClassStatus"];
export type ClassSheet = S["ClassSheet"];
export type SheetRow = S["StudentRow"];
export type ApiReportCard = S["ReportCard"];
export type Schedule = S["ScheduleOut"];
export type ScheduleDetail = S["ScheduleDetail"];

export const resultKeys = { all: ["results"] as const };

type Q = Record<string, string | number | boolean | undefined | null>;
const useGet = <T,>(key: unknown[], path: string, params?: Q, enabled = true) =>
  useQuery({ queryKey: key, enabled: isLive && enabled, queryFn: ({ signal }) => api.useGet<T>(path, params, signal) });

function useResultMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: resultKeys.all }), qc.invalidateQueries({ queryKey: ["analytics"] })]),
  });
}

export const useSchemes = () => get<Scheme[]>([...resultKeys.all, "schemes"], "/grading-schemes");
export const useAddScheme = () => useResultMutation((b: { name: string; bands: { min_percent: number; grade: string }[]; make_active: boolean }) => api.post<Scheme>("/grading-schemes", b));
export const useEditScheme = () => useResultMutation((v: { id: string; name?: string; bands?: { min_percent: number; grade: string }[] }) => { const { id, ...b } = v; return api.patch<Scheme>(`/grading-schemes/${id}`, b); });
export const useActivateScheme = () => useResultMutation((id: string) => api.post<Scheme>(`/grading-schemes/${id}/activate`));

export const useExams = (yearId?: string) => get<Page<Exam>>([...resultKeys.all, "exams", yearId ?? "current"], "/exams", { year_id: yearId });
export const useAddExam = () => useResultMutation((b: { name: string; starts_on?: string | null; ends_on?: string | null }) => api.post<Exam>("/exams", b));
export const useEditExam = () => useResultMutation((v: { id: string; name?: string; starts_on?: string | null; ends_on?: string | null }) => { const { id, ...b } = v; return api.patch<Exam>(`/exams/${id}`, b); });
export const useDeleteExam = () => useResultMutation((id: string) => api.delete(`/exams/${id}`));
export const useSetPapers = () => useResultMutation((v: { examId: string; class_ids: string[]; papers: { subject_id: string; max_marks: number; pass_marks?: number | null }[] }) => {
  const { examId, ...b } = v; return api.put<Paper[]>(`/exams/${examId}/papers`, b);
});

export const useExamClasses = (examId: string | null) => get<ExamClassStatus[]>([...resultKeys.all, "classes", examId], `/exams/${examId}/classes`, undefined, !!examId);
export const useClassSheet = (examId: string | null, classId: string | null) =>
  get<ClassSheet>([...resultKeys.all, "sheet", examId, classId], `/exams/${examId}/classes/${classId}/sheet`, undefined, !!examId && !!classId);

export interface MarkEntry { enrollment_id: string; subject_id: string; marks_obtained: number | null; absent: boolean }
export const useSaveMarks = () => useResultMutation((v: { examId: string; classId: string; entries: MarkEntry[] }) => api.put<S["MarksSaved"]>(`/exams/${v.examId}/classes/${v.classId}/marks`, { entries: v.entries }));
export const useSaveRemarks = () => useResultMutation((v: { examId: string; classId: string; remarks: { enrollment_id: string; remark: string }[] }) => api.put<S["ChangedOut"]>(`/exams/${v.examId}/classes/${v.classId}/remarks`, { remarks: v.remarks }));
export const usePublish = () => useResultMutation((v: { examId: string; classId: string }) => api.post<S["PublishedOut"]>(`/exams/${v.examId}/classes/${v.classId}/publish`));
export const useUnpublish = () => useResultMutation((v: { examId: string; classId: string }) => api.post<void>(`/exams/${v.examId}/classes/${v.classId}/unpublish`));

/** One student's report card as JSON; fetched on demand (not cached long). */
export const fetchReportCard = (examId: string, studentId: string) => api.get<ApiReportCard>(`/exams/${examId}/students/${studentId}/report-card`);

export const useSchedules = () => get<Schedule[]>([...resultKeys.all, "schedules"], "/exam-schedules");
export const useSchedule = (id: string | null) => get<ScheduleDetail>([...resultKeys.all, "schedule", id], `/exam-schedules/${id}`, undefined, !!id);
export const useAddSchedule = () => useResultMutation((b: { name: string; exam_id?: string | null }) => api.post<Schedule>("/exam-schedules", b));
export const useSetSchedulePapers = () => useResultMutation((v: { id: string; papers: { class_id: string; subject_id: string; paper_on: string; starts_at: string }[] }) => api.put<ScheduleDetail>(`/exam-schedules/${v.id}/papers`, { papers: v.papers }));
export const usePublishSchedule = () => useResultMutation((v: { id: string; publish: boolean }) => api.post<Schedule>(`/exam-schedules/${v.id}/${v.publish ? "publish" : "unpublish"}`));
export const useDeleteSchedule = () => useResultMutation((id: string) => api.delete(`/exam-schedules/${id}`));
