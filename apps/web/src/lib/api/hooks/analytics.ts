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
export type StaffAttendanceAnalytics = S["StaffAttendanceAnalytics"];

type Q = Record<string, string | number | boolean | undefined | null>;
const useGet = <T,>(key: unknown[], path: string, params?: Q, enabled = true) =>
  useQuery({ queryKey: ["analytics", ...key], enabled: isLive && enabled, queryFn: ({ signal }) => api.useGet<T>(path, params, signal) });

export const useStudentsAnalytics = () => get<StudentsAnalytics>(["students"], "/analytics/students");
export const useAttendanceAnalytics = (from_on: string, to_on: string, class_id?: string) =>
  get<AttendanceAnalytics>(["attendance", from_on, to_on, class_id], "/analytics/attendance", { from_on, to_on, class_id }, !!from_on && !!to_on);
export const useFeesAnalytics = (enabled: boolean) => get<FeesAnalytics>(["fees"], "/analytics/fees", undefined, enabled);
export const useResultsAnalytics = (exam_id?: string) => get<ResultsAnalytics>(["results", exam_id], "/analytics/results", { exam_id });
export const useTeacherResults = (exam_id?: string) => get<TeacherResults>(["teachers", exam_id], "/analytics/results/teachers", { exam_id });
export const useStaffAttendanceAnalytics = (from_on: string, to_on: string, enabled: boolean) =>
  get<StaffAttendanceAnalytics>(["staff-attendance", from_on, to_on], "/analytics/staff-attendance", { from_on, to_on }, enabled && !!from_on && !!to_on);
