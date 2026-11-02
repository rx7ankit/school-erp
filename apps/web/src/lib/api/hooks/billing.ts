"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { isLive } from "../config";
import type { SchoolBilling } from "../types";

/** The school's own Slov subscription. Admin only on the API (403 for anyone else). */
export const useSchoolBilling = (enabled = true) =>
  useQuery({ queryKey: ["school", "billing"], enabled: isLive && enabled, queryFn: ({ signal }) => api.get<SchoolBilling>("/school/billing", undefined, signal) });
