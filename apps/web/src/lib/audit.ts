"use client";
import * as React from "react";
import { STAFF } from "./mock";
import { nowUTC } from "./time";

/**
 * Audit trail: who did what, when. Admin-only to read. Every sensitive change in the app calls logAudit().
 * The real backend writes these rows server-side, so they cannot be skipped or edited from the client.
 */
export type AuditCategory = "attendance" | "fees" | "students" | "staff" | "academic" | "messages" | "leave" | "security" | "exports";
export interface AuditChange { field: string; from: string; to: string; }
export interface AuditEvent {
  id: string; at: string; actorName: string; actorRole: string; category: AuditCategory;
  action: string; summary: string; entity?: string; href?: string; sensitive?: boolean; changes?: AuditChange[];
}

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  attendance: "Attendance", fees: "Fees and money", students: "Students", staff: "Staff and access", academic: "Academic",
  messages: "Messages", leave: "Leave", security: "Sign-in and security", exports: "Exports",
};

const KEY = "slov.audit";
const EVT = "slov:audit";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const raw = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

/** Who is signed in right now, read from the demo session. */
function actor(): { name: string; role: string } {
  try {
    const [kind, id] = (localStorage.getItem("slov.session") ?? "").split(":");
    if (kind === "staff") { const s = STAFF.find((x) => x.id === id); if (s) return { name: s.name, role: s.isAdmin ? "Admin" : s.designation }; }
    if (kind === "parent") return { name: "Parent", role: "Parent" };
    if (kind === "owner") return { name: "Slov owner", role: "Platform owner" };
  } catch {}
  return { name: "System", role: "System" };
}

export function logAudit(e: Omit<AuditEvent, "id" | "at" | "actorName" | "actorRole"> & { actorName?: string; actorRole?: string }) {
  const a = actor(); const at = nowUTC();
  const ev: AuditEvent = { ...e, id: `${at}-${Math.random().toString(36).slice(2, 7)}`, at, actorName: e.actorName ?? a.name, actorRole: e.actorRole ?? a.role };
  let cur: AuditEvent[] = [];
  try { cur = JSON.parse(raw() || "[]"); } catch {}
  try { localStorage.setItem(KEY, JSON.stringify([ev, ...cur].slice(0, 400))); } catch {}
  window.dispatchEvent(new Event(EVT));
}

/* ---------- Seed history so the page is useful on first open ---------- */
const T = (daysAgo: number, hh: number, mm: number) => { const d = new Date(Date.UTC(2026, 10, 1, hh, mm)); d.setUTCDate(d.getUTCDate() - daysAgo); return d.toISOString(); };
type Seed = [number, number, number, string, string, AuditCategory, string, string, string?, boolean?, AuditChange[]?];
const SEEDS: Seed[] = [
  [0, 9, 42, "Meera Rao", "Admin", "security", "login.success", "Signed in"],
  [0, 5, 10, "Rajiv Mishra", "Mathematics Teacher", "attendance", "attendance.saved", "Saved attendance for Class 8-B (6 students, 1 absent, 1 half day)", "Class 8-B"],
  [0, 5, 22, "Sunita Dwivedi", "English Teacher", "attendance", "attendance.saved", "Saved attendance for Class 6-A (6 students, all present)", "Class 6-A"],
  [0, 6, 5, "Suresh Tiwari", "Accountant", "fees", "payment.recorded", "Recorded ₹9,500 (UPI) for Ananya Agrawal against INV-3002", "INV-3002"],
  [0, 6, 48, "Suresh Tiwari", "Accountant", "fees", "payment.cancelled", "Cancelled payment RCP-3012 of ₹10,500 for Priya Sahu. Reason: entered against the wrong student", "INV-3012", true, [{ field: "Payment status", from: "Active", to: "Cancelled" }, { field: "Balance", from: "₹11,500", to: "₹22,000" }]],
  [0, 7, 30, "Anil Shukla", "Vice Principal", "staff", "staff.access_changed", "Gave Library access to Dinesh Gupta", "Dinesh Gupta", true, [{ field: "Library permission", from: "Off", to: "On" }]],
  [1, 4, 55, "Rajiv Mishra", "Mathematics Teacher", "academic", "results.published", "Published Unit Test 2 results for Class 8-B", "Class 8-B"],
  [1, 5, 40, "Anil Shukla", "Vice Principal", "students", "student.left", "Marked Zoya Singh as left school. Reason: family moved to Bhopal", "Zoya Singh", true, [{ field: "Status", from: "Active", to: "Left school" }]],
  [1, 5, 44, "Meera Rao", "Admin", "students", "certificate.issued", "Issued transfer certificate TC-2026-014 for Zoya Singh", "TC-2026-014", true],
  [1, 8, 15, "Pooja Singh", "Hindi Teacher", "leave", "leave.approved", "Approved leave of Ishita Rajak for 2 Nov to 3 Nov", "Ishita Rajak"],
  [1, 9, 2, "Meera Rao", "Admin", "exports", "export.created", "Exported fees to Excel (36 rows)"],
  [2, 6, 20, "Suresh Tiwari", "Accountant", "fees", "invoices.generated", "Generated Term 2 invoices for 6 classes (36 invoices, ₹7,20,000)", "Term 2", true],
  [2, 6, 40, "Suresh Tiwari", "Accountant", "fees", "latefee.waived", "Waived late fee of ₹500 on INV-3004. Reason: school closed on the due date", "INV-3004", true, [{ field: "Late fee", from: "₹500", to: "₹0" }]],
  [2, 8, 12, "Anil Shukla", "Vice Principal", "academic", "notice.published", "Published notice \"Diwali holidays announced\" to everyone", "Notice"],
  [2, 8, 30, "Anil Shukla", "Vice Principal", "academic", "examsheet.published", "Published exam date sheet \"Half-yearly exams\" for 6 classes", "Half-yearly exams"],
  [2, 10, 5, "Meera Rao", "Admin", "staff", "staff.added", "Added staff member Anita Joshi (English Teacher)", "Anita Joshi"],
  [2, 10, 8, "Meera Rao", "Admin", "staff", "login.sent", "Sent login email to Anita Joshi", "Anita Joshi"],
  [3, 5, 2, "Farhan Khan", "Science Teacher", "attendance", "attendance.saved", "Saved attendance for Class 8-A (6 students, 2 absent)", "Class 8-A"],
  [3, 7, 40, "Meera Rao", "Admin", "staff", "staff.absent", "Marked Farhan Khan absent today. Reason: medical leave", "Farhan Khan"],
  [3, 7, 55, "Anil Shukla", "Vice Principal", "academic", "substitute.assigned", "Assigned Rajiv Mishra to cover Class 8-A, period 3", "Class 8-A"],
  [3, 11, 20, "Unknown", "Not signed in", "security", "login.failed", "Failed sign-in attempt for principal@rewapublic.example (wrong password)", undefined, true],
  [4, 6, 10, "Meera Rao", "Admin", "security", "password.changed", "Changed their password", undefined, true],
  [4, 9, 30, "Kavita Pandey", "Librarian", "students", "library.issued", "Issued \"Wings of Fire\" to Aarav Tiwari"],
  [5, 5, 15, "Rajiv Mishra", "Mathematics Teacher", "messages", "broadcast.sent", "Broadcast to Class 8-B (Mathematics): \"Chapter 7 practice sheet attached\"", "Class 8-B"],
  [5, 7, 0, "Meera Rao", "Admin", "messages", "broadcast.sent", "School-wide broadcast: \"Annual sports day on 12 December\"", "Whole school"],
  [6, 6, 33, "Anil Shukla", "Vice Principal", "students", "students.imported", "Imported 18 students from Excel (2 rows skipped)", "students.xlsx"],
  [6, 8, 20, "Meera Rao", "Admin", "staff", "classteacher.changed", "Changed class teacher of Class 7-A from Anita Joshi to Pooja Singh", "Class 7-A", true, [{ field: "Class teacher, 7-A", from: "Anita Joshi", to: "Pooja Singh" }]],
  [7, 5, 50, "Suresh Tiwari", "Accountant", "fees", "reminders.sent", "Sent fee reminders to 23 parents (₹3,72,000 due)", "Term 2", true],
  [8, 7, 14, "Meera Rao", "Admin", "academic", "grading.changed", "Changed grading scheme: pass mark 35% to 40%", "Grading", true, [{ field: "Pass mark", from: "35%", to: "40%" }]],
  [9, 9, 45, "Anil Shukla", "Vice Principal", "students", "student.edited", "Updated details of Kabir Shukla (emergency contact)", "Kabir Shukla"],
  [10, 6, 5, "Meera Rao", "Admin", "security", "login.success", "Signed in"],
  [11, 8, 35, "Anil Shukla", "Vice Principal", "academic", "class.created", "Created Class 9-B", "Class 9-B"],
  [12, 5, 5, "Meera Rao", "Admin", "staff", "login.sent", "Sent login emails to 9 staff"],
];
const SEED_EVENTS: AuditEvent[] = SEEDS.map(([d, h, m, actorName, actorRole, category, action, summary, entity, sensitive, changes], i) => ({
  id: `seed-${i}`, at: T(d, h, m), actorName, actorRole, category, action, summary, entity, sensitive, changes,
}));

export function useAudit(): AuditEvent[] {
  const stored = React.useSyncExternalStore(subscribe, raw, () => "");
  return React.useMemo(() => {
    let live: AuditEvent[] = [];
    try { live = stored ? JSON.parse(stored) : []; } catch {}
    return [...live, ...SEED_EVENTS].sort((a, b) => b.at.localeCompare(a.at));
  }, [stored]);
}
