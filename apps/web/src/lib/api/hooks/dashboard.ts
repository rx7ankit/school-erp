"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { ClassOut, Dashboard, Page } from "../types";

/** Everything the staff dashboard shows, from one call. Blocks the person may not see arrive as null. */
export const useDashboard = () =>
  useQuery({ queryKey: ["dashboard", "aggregate"], enabled: isLive, refetchInterval: 120_000, queryFn: ({ signal }) => api.get<Dashboard>("/dashboard", undefined, signal) });

/** Class list, for the "my classes" card (names and student counts). 409 when the school has no current year. */
export const useDashboardClasses = (enabled: boolean) =>
  useQuery({ queryKey: ["dashboard", "classes"], enabled: isLive && enabled, retry: false, queryFn: () => api.get<Page<ClassOut>>("/academic/classes") });
