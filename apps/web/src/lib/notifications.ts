"use client";
import * as React from "react";
import { STUDENTS, className } from "./mock";
import { formatDateOn, formatINR, nowUTC } from "./time";

export type NotifType = "attendance_present" | "attendance_absent" | "attendance_first_half" | "attendance_second_half" | "fee_reminder" | "notice" | "exam" | "result" | "feedback" | "leave_approved" | "leave_rejected" | "report_card";
export interface Notif { id: string; type: NotifType; studentId: string; at: string; params: { amountPaise?: number; dueOn?: string; title?: string }; }

const KEY = "scool.notifs";   // sent notifications (shared across tabs of this browser, as a stand-in for push)
const READ = "scool.notifs.read";
const EVT = "scool:notifs";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const raw = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const parse = <T,>(s: string, fallback: T): T => { try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } };

/** Send notifications. In production the backend does this and delivers a push to the parent's phone. */
export function notify(items: Omit<Notif, "id" | "at">[]) {
  if (!items.length) return;
  const at = nowUTC();
  const cur = parse<Notif[]>(raw(KEY), []);
  const next = [...items.map((n, i) => ({ ...n, id: `${at}-${i}-${n.studentId}`, at })), ...cur].slice(0, 300);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event(EVT));
}

/** A few older items so the list is never empty in the demo. */
function seeds(studentId: string): Notif[] {
  return [
    { id: `seed-${studentId}-1`, type: "notice", studentId, at: "2026-10-30T05:00:00Z", params: { title: "Diwali holidays announced" } },
    { id: `seed-${studentId}-2`, type: "result", studentId, at: "2026-10-29T06:30:00Z", params: { title: "Unit Test 2" } },
    { id: `seed-${studentId}-3`, type: "attendance_present", studentId, at: "2026-10-28T03:40:00Z", params: {} },
  ];
}

export function useNotifications(studentIds: string[]) {
  const sent = React.useSyncExternalStore(subscribe, () => raw(KEY), () => "");
  const read = React.useSyncExternalStore(subscribe, () => raw(READ), () => "");
  const key = studentIds.join(",");
  return React.useMemo(() => {
    const ids = key ? key.split(",") : [];
    const all = [...parse<Notif[]>(sent, []), ...ids.flatMap(seeds)].filter((n) => ids.includes(n.studentId)).sort((a, b) => b.at.localeCompare(a.at));
    const readSet = new Set(parse<string[]>(read, []));
    const items = all.map((n) => ({ ...n, read: readSet.has(n.id) || n.id.startsWith("seed-") }));
    return {
      items, unread: items.filter((n) => !n.read).length,
      markAllRead: () => { try { localStorage.setItem(READ, JSON.stringify(all.map((n) => n.id))); } catch {} window.dispatchEvent(new Event(EVT)); },
    };
  }, [sent, read, key]);
}

/** Notification texts shown in the app (the exact wording from the product spec). */
export function notifText(n: Notif): { title: string; body: string } {
  const s = STUDENTS.find((x) => x.id === n.studentId);
  const name = s?.name.split(" ")[0] ?? "";
  const due = n.params.dueOn ? formatDateOn(n.params.dueOn) : "";
  switch (n.type) {
    case "attendance_present": return { title: "Attendance", body: `${name} is present today` };
    case "attendance_absent": return { title: "Attendance", body: `${name} is absent today` };
    case "attendance_first_half": return { title: "Attendance", body: `${name} attended the first half only` };
    case "attendance_second_half": return { title: "Attendance", body: `${name} attended the second half only` };
    case "fee_reminder": return { title: "Fee reminder", body: `Fee reminder: ${formatINR(n.params.amountPaise ?? 0)} is due for ${name} by ${due}` };
    case "notice": return { title: "New notice", body: n.params.title ?? "" };
    case "exam": return { title: "Exam date sheet", body: n.params.title ?? "" };
    case "result": return { title: "Result published", body: `See ${name}'s ${n.params.title} result` };
    case "leave_approved": return { title: "Leave approved", body: `Leave approved for ${name}` };
    case "leave_rejected": return { title: "Leave not approved", body: `Leave rejected for ${name}` };
    case "report_card": return { title: "Report card ready", body: `${name}'s report card is ready` };
    case "feedback": return { title: "Feedback requested", body: "Tell the school how the teachers are doing" };
  }
}
export const classOf = (studentId: string) => { const s = STUDENTS.find((x) => x.id === studentId); return s ? className(s.classId) : ""; };
