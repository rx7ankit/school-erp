"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { ClassOut, Page, YearOut } from "../types";
import { academicKeys, useStaffList } from "./academic";

/** What the live dashboard can honestly show today: the current year, its classes and the people on the roster. */
export function useDashboardCounts(canSeeStaff: boolean) {
  const years = useQuery({ queryKey: ["dashboard", "years"], enabled: isLive, queryFn: () => api.get<Page<YearOut>>("/academic/years") });
  const hasCurrent = years.data?.items.some((y) => y.status === "current") ?? false;
  const classes = useQuery({
    queryKey: [...academicKeys.classes(), "dashboard"], enabled: isLive && hasCurrent,
    queryFn: () => api.get<Page<ClassOut>>("/academic/classes"),
  });
  const staff = useStaffList(canSeeStaff);
  const year = years.data?.items.find((y) => y.status === "current") ?? null;
  const students = classes.data?.items.reduce((s, c) => s + c.students, 0) ?? 0;
  const withoutTeacher = classes.data?.items.filter((c) => !c.class_teacher_id).length ?? 0;
  return { years, classes, staff, year, hasCurrent, students, withoutTeacher };
}
