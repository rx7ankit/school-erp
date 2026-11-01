"use client";
import * as React from "react";
import { notify } from "./notifications";
import { nowUTC, todayOnIST } from "./time";
import { logAudit } from "./audit";
import { STUDENTS } from "./mock";

/**
 * Leave applications (demo store). Backed by localStorage so a parent in one tab and a teacher in another
 * see the same data, the same trick notifications use. Dates are IST calendar dates (YYYY-MM-DD).
 */
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type LeaveHalf = "none" | "first" | "second";
export interface LeaveRequest {
  id: string; studentId: string; fromOn: string; toOn: string; half: LeaveHalf; reason: string;
  status: LeaveStatus; createdAt: string; decidedBy?: string; decidedAt?: string; note?: string;
}
export const REASON_MAX = 200;

const KEY = "scool.leave";
const EVT = "scool:leave";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const raw = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const parse = (s: string): LeaveRequest[] => { try { return s ? (JSON.parse(s) as LeaveRequest[]) : []; } catch { return []; } };

/** Seeds. Anything a user changes is copied into storage and wins over the seed with the same id. */
const SEED: LeaveRequest[] = [
  { id: "lv-seed-1", studentId: "st2", fromOn: "2026-11-03", toOn: "2026-11-04", half: "none", reason: "Family wedding in Satna.", status: "pending", createdAt: "2026-10-31T10:15:00Z" },
  { id: "lv-seed-2", studentId: "st4", fromOn: "2026-11-02", toOn: "2026-11-02", half: "second", reason: "Dentist appointment in the afternoon.", status: "pending", createdAt: "2026-10-31T13:40:00Z" },
  { id: "lv-seed-3", studentId: "st16", fromOn: "2026-10-30", toOn: "2026-11-03", half: "none", reason: "Fever and doctor's advice to rest.", status: "approved", createdAt: "2026-10-29T16:05:00Z", decidedBy: "Rajiv Mishra", decidedAt: "2026-10-30T03:20:00Z", note: "Get well soon." },
  { id: "lv-seed-4", studentId: "st9", fromOn: "2026-10-12", toOn: "2026-10-12", half: "first", reason: "Eye check-up.", status: "approved", createdAt: "2026-10-10T09:00:00Z", decidedBy: "Farhan Khan", decidedAt: "2026-10-10T11:30:00Z" },
  { id: "lv-seed-5", studentId: "st10", fromOn: "2026-10-26", toOn: "2026-10-27", half: "none", reason: "Visiting grandparents.", status: "rejected", createdAt: "2026-10-23T07:50:00Z", decidedBy: "Rajiv Mishra", decidedAt: "2026-10-24T04:10:00Z", note: "Unit test on 27 October. Please apply for another date." },
];

function merged(s: string): LeaveRequest[] {
  const stored = parse(s);
  const ids = new Set(stored.map((x) => x.id));
  return [...stored, ...SEED.filter((x) => !ids.has(x.id))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
const all = () => merged(raw());
/** Every request right now (not reactive; use useLeaves in components). */
export const allLeaves = (): LeaveRequest[] => all();
/** Write one changed or new request. */
function save(next: LeaveRequest) {
  const stored = parse(raw()).filter((x) => x.id !== next.id);
  try { localStorage.setItem(KEY, JSON.stringify([next, ...stored])); } catch {}
  window.dispatchEvent(new Event(EVT));
}

/** Every leave request, newest first. Re-renders when any tab changes them. */
export function useLeaves(): LeaveRequest[] {
  const s = React.useSyncExternalStore(subscribe, raw, () => "");
  return React.useMemo(() => merged(s), [s]);
}

const isActive = (l: LeaveRequest) => l.status === "pending" || l.status === "approved";
const overlaps = (a: { fromOn: string; toOn: string }, b: { fromOn: string; toOn: string }) => a.fromOn <= b.toOn && b.fromOn <= a.toOn;

export interface LeaveInput { studentId: string; fromOn: string; toOn: string; half: LeaveHalf; reason: string; }
/** First problem with an application, or null when it is fine. */
export function validateLeave(input: LeaveInput, existing: LeaveRequest[] = all(), todayOn = todayOnIST()): string | null {
  if (!input.fromOn || !input.toOn) return "Choose the dates.";
  if (input.fromOn < todayOn) return "Leave cannot start before today.";
  if (input.toOn < input.fromOn) return "The last day cannot be before the first day.";
  if (input.half !== "none" && input.fromOn !== input.toOn) return "A half day can only be for a single day.";
  const reason = input.reason.trim();
  if (!reason) return "Tell the school the reason.";
  if (reason.length > REASON_MAX) return `Keep the reason within ${REASON_MAX} characters.`;
  if (existing.some((l) => l.studentId === input.studentId && isActive(l) && overlaps(l, input))) return "There is already a leave request for these dates.";
  return null;
}

export function applyLeave(input: LeaveInput): { ok: true; leave: LeaveRequest } | { ok: false; error: string } {
  const error = validateLeave(input);
  if (error) return { ok: false, error };
  const leave: LeaveRequest = { ...input, reason: input.reason.trim(), id: `lv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, status: "pending", createdAt: nowUTC() };
  save(leave);
  return { ok: true, leave };
}

/** A parent can withdraw a request only while it is still pending. */
export function cancelLeave(id: string): boolean {
  const l = all().find((x) => x.id === id);
  if (!l || l.status !== "pending") return false;
  save({ ...l, status: "cancelled" });
  return true;
}

/** Class teacher or admin decides. The parent is notified straight away. */
export function decide(id: string, action: "approve" | "reject", note: string, by: string): boolean {
  const l = all().find((x) => x.id === id);
  if (!l || l.status !== "pending") return false;
  save({ ...l, status: action === "approve" ? "approved" : "rejected", decidedBy: by, decidedAt: nowUTC(), note: note.trim() || undefined });
  notify([{ type: action === "approve" ? "leave_approved" : "leave_rejected", studentId: l.studentId, params: {} }]);
  const who = STUDENTS.find((s) => s.id === l.studentId)?.name ?? "student";
  logAudit({ category: "leave", action: action === "approve" ? "leave.approved" : "leave.rejected", summary: `${action === "approve" ? "Approved" : "Rejected"} leave of ${who} for ${l.fromOn} to ${l.toOn}${note.trim() ? `. Note: ${note.trim()}` : ""}`, entity: who, href: "/leave" });
  return true;
}

/** Approved leave that covers this date, if any. */
export function leaveFor(studentId: string, dateOn: string, list: LeaveRequest[] = all()): LeaveRequest | undefined {
  return list.find((l) => l.studentId === studentId && l.status === "approved" && l.fromOn <= dateOn && dateOn <= l.toOn);
}
