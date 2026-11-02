"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { components } from "../schema";

type S = components["schemas"];
export type StudentsAnalytics = S["StudentsAnalytics"];
export type AttendanceAnalytics = S["Analytics"];
export type FeesAnalytics = S["FeesAnalytics"];
export type ResultsAnalytics = S["ResultsAnalytics"];
export type TeacherResults = S["TeacherResults"];
export type TeacherWise = S["TeacherWise"];
export type TeacherWiseRow = S["TeacherWiseRow"];
export type SubjectWise = S["SubjectWise"];
export type StaffAttendanceAnalytics = S["StaffAttendanceAnalytics"];

type Q = Record<string, string | number | boolean | undefined | null>;
const useGet = <T,>(key: unknown[], path: string, params?: Q, enabled = true) =>
  useQuery({ queryKey: ["analytics", ...key], enabled: isLive && enabled, queryFn: ({ signal }) => api.get<T>(path, params, signal) });

export const useStudentsAnalytics = () => useGet<StudentsAnalytics>(["students"], "/analytics/students");
export const useAttendanceAnalytics = (from_on: string, to_on: string, class_id?: string) =>
  useGet<AttendanceAnalytics>(["attendance", from_on, to_on, class_id], "/analytics/attendance", { from_on, to_on, class_id }, !!from_on && !!to_on);
export const useFeesAnalytics = (enabled: boolean) => useGet<FeesAnalytics>(["fees"], "/analytics/fees", undefined, enabled);
export const useResultsAnalytics = (exam_id?: string) => useGet<ResultsAnalytics>(["results", exam_id], "/analytics/results", { exam_id });
export const useTeacherResults = (exam_id?: string) => useGet<TeacherResults>(["teachers", exam_id], "/analytics/results/teachers", { exam_id });
export const useStaffAttendanceAnalytics = (from_on: string, to_on: string, enabled: boolean) =>
  useGet<StaffAttendanceAnalytics>(["staff-attendance", from_on, to_on], "/analytics/staff-attendance", { from_on, to_on }, enabled && !!from_on && !!to_on);
export const useTeacherWise = (p: { from_on: string; to_on: string; exam_id?: string }) =>
  useGet<TeacherWise>(["teacher-wise", p.from_on, p.to_on, p.exam_id], "/analytics/teachers", p, !!p.from_on && !!p.to_on);
export const useSubjectWise = (exam_id?: string) => useGet<SubjectWise>(["subject-wise", exam_id], "/analytics/subjects", { exam_id });
