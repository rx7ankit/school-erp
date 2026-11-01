/**
 * Demo store for fee setup and invoicing. Module-level and mutable, like lib/mock.ts.
 * Rules follow docs/erd.md (v6): invoice total = items + late fee + carried forward - discounts,
 * paid = sum of active payments, payments are cancelled never deleted, receipt numbers never reused.
 * Swap for API calls when the backend exists. Pages subscribe with useFeesStore() to re-render.
 */
import * as React from "react";
import { CLASSES, INVOICES, STUDENTS, settle, type FeeMode, type FeePayment, type Invoice, type InvoiceItem } from "./mock";
import { formatINR, nowUTC } from "./time";
import { logAudit } from "./audit";

/* ---------- Types ---------- */
export type Frequency = "monthly" | "quarterly" | "term" | "yearly" | "once";
export interface FeeHead { id: string; name: string; frequency: Frequency; }
export type ConcessionKind = "percent" | "fixed" | "waive_head";
/** percent: value is 0-100. fixed: value is paise. waive_head: the whole amount of `headId`. headId optional for percent and fixed. */
export interface Concession { id: string; name: string; kind: ConcessionKind; value: number; headId?: string; }
export interface StudentConcession { id: string; studentId: string; concessionId: string; note: string; approvedBy: string; at: string; }
export interface LateRule { enabled: boolean; graceDays: number; amountPaise: number; per: "once" | "day"; maxPaise: number; }
export interface InvoiceRun { id: string; period: string; dueOn: string; at: string; by: string; created: number; skipped: number; totalPaise: number; classIds: string[]; headIds: string[]; }
export interface Waiver { reason: string; by: string; at: string; amountPaise: number; }
export type Result = { ok: true } | { ok: false; error: string };

export const FREQUENCY_LABEL: Record<Frequency, string> = { monthly: "Monthly", quarterly: "Quarterly", term: "Per term", yearly: "Yearly", once: "Once" };

/* ---------- State ---------- */
let seq = 100;
const uid = (p: string) => `${p}${++seq}`;

export const HEADS: FeeHead[] = [
  { id: "h-tuition", name: "Tuition", frequency: "term" },
  { id: "h-activity", name: "Activity and lab", frequency: "term" },
  { id: "h-transport", name: "Transport", frequency: "term" },
  { id: "h-admission", name: "Admission", frequency: "once" },
];

/** Amount in paise by class then head. Missing or 0 means the head is not billed to that class. */
export const STRUCTURE: Record<string, Record<string, number>> = {};
for (const c of CLASSES) {
  const total = 1_200_000 + Number(c.grade) * 100_000; // same as the seeded Term 2 invoices
  const tuition = Math.round(total * 0.75);
  STRUCTURE[c.id] = { "h-tuition": tuition, "h-activity": total - tuition, "h-transport": 600_000, "h-admission": 500_000 };
}

export const CONCESSIONS: Concession[] = [
  { id: "cn-sibling", name: "Sibling discount", kind: "percent", value: 10, headId: "h-tuition" },
  { id: "cn-rte", name: "RTE (full tuition waiver)", kind: "waive_head", value: 0, headId: "h-tuition" },
  { id: "cn-staff", name: "Staff child", kind: "percent", value: 50, headId: "h-tuition" },
  { id: "cn-merit", name: "Merit scholarship", kind: "fixed", value: 100_000 },
];

export const ASSIGNMENTS: StudentConcession[] = [
  { id: "sc1", studentId: "st9", concessionId: "cn-sibling", note: "Sibling of Ananya Mishra (class 7-A).", approvedBy: "Meera Rao", at: "2026-04-10T05:30:00Z" },
  { id: "sc2", studentId: "st2", concessionId: "cn-sibling", note: "Sibling of Saanvi Mishra (class 8-B).", approvedBy: "Meera Rao", at: "2026-04-10T05:34:00Z" },
  { id: "sc3", studentId: "st14", concessionId: "cn-merit", note: "Topper in the Class 7 annual exam.", approvedBy: "Meera Rao", at: "2026-04-12T06:10:00Z" },
];

export const LATE_RULE: LateRule = { enabled: true, graceDays: 5, amountPaise: 20_000, per: "once", maxPaise: 100_000 };

export const RUNS: InvoiceRun[] = [
  { id: "run1", period: "Term 2", dueOn: "2026-11-10", at: "2026-10-05T05:20:00Z", by: "Suresh Tiwari", created: INVOICES.length, skipped: 0, totalPaise: INVOICES.reduce((a, i) => a + i.totalPaise, 0), classIds: CLASSES.map((c) => c.id), headIds: ["h-tuition", "h-activity"] },
];

/** Side tables, because the shared Invoice and FeePayment shapes have no field for these. */
const closedInto = new Map<string, string>(); // old invoice id -> invoice no it was carried into
const cancelledBy = new Map<string, string>(); // payment id -> staff name
const waivers = new Map<string, Waiver>(); // invoice id -> waiver
export const closedNote = (inv: Invoice) => closedInto.get(inv.id);
export const isClosed = (inv: Invoice) => closedInto.has(inv.id);
export const cancelledByOf = (paymentId: string) => cancelledBy.get(paymentId);
export const waiverOf = (inv: Invoice) => waivers.get(inv.id);

/* ---------- Subscribe ---------- */
let version = 0;
const listeners = new Set<() => void>();
const touch = () => { version++; listeners.forEach((l) => l()); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
/** Re-renders the caller whenever the fee store or the shared INVOICES change through this module. */
export function useFeesStore(): number {
  return React.useSyncExternalStore(subscribe, () => version, () => 0);
}

/* ---------- Helpers ---------- */
export const headName = (id: string) => HEADS.find((h) => h.id === id)?.name ?? "Removed head";
export const balanceOf = (inv: Invoice) => inv.totalPaise - inv.paidPaise;
/** What an invoice contributes to "billed": a closed invoice only counts what was paid on it, the rest moved forward. */
export const billedOf = (inv: Invoice) => (isClosed(inv) ? inv.paidPaise : inv.totalPaise);
/** What is still owed on an invoice (zero once closed, because it moved to the next invoice). */
export const owedOf = (inv: Invoice) => (isClosed(inv) ? 0 : Math.max(0, balanceOf(inv)));
export const concessionLabel = (c: Concession) =>
  c.kind === "percent" ? `${c.value}% off${c.headId ? ` ${headName(c.headId)}` : ""}`
  : c.kind === "fixed" ? `${formatINR(c.value)} off${c.headId ? ` ${headName(c.headId)}` : ""}`
  : `Full ${headName(c.headId ?? "")} waiver`;
const daysBetween = (fromOn: string, toOn: string) => Math.round((Date.parse(`${toOn}T00:00:00Z`) - Date.parse(`${fromOn}T00:00:00Z`)) / 86_400_000);
const samePeriod = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const nextNumber = (nos: string[], floor: number) => Math.max(floor, ...nos.map((n) => Number(/\d+/.exec(n)?.[0] ?? 0))) + 1;

/* ---------- Heads and structure ---------- */
export function addHead(name: string, frequency: Frequency): Result {
  const n = name.trim();
  if (n.length < 2) return { ok: false, error: "Enter a name of at least 2 letters" };
  if (HEADS.some((h) => h.name.toLowerCase() === n.toLowerCase())) return { ok: false, error: "A head with this name already exists" };
  HEADS.push({ id: uid("h-"), name: n, frequency });
  touch();
  return { ok: true };
}
export function updateHead(id: string, name: string, frequency: Frequency): Result {
  const h = HEADS.find((x) => x.id === id); const n = name.trim();
  if (!h) return { ok: false, error: "Head not found" };
  if (n.length < 2) return { ok: false, error: "Enter a name of at least 2 letters" };
  if (HEADS.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) return { ok: false, error: "A head with this name already exists" };
  h.name = n; h.frequency = frequency; touch();
  return { ok: true };
}
/** Existing invoices keep their lines. Concessions tied to the head become general. */
export function removeHead(id: string) {
  const i = HEADS.findIndex((h) => h.id === id);
  if (i >= 0) HEADS.splice(i, 1);
  Object.values(STRUCTURE).forEach((row) => { delete row[id]; });
  CONCESSIONS.forEach((c) => { if (c.headId === id) c.headId = undefined; });
  touch();
}
export function saveStructure(next: Record<string, Record<string, number>>) {
  for (const [classId, row] of Object.entries(next)) STRUCTURE[classId] = { ...row };
  touch();
}

/* ---------- Concessions ---------- */
export function addConcession(c: Omit<Concession, "id">): Result {
  const name = c.name.trim();
  if (name.length < 2) return { ok: false, error: "Enter a name for the concession" };
  if (CONCESSIONS.some((x) => x.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: "A concession with this name already exists" };
  if (c.kind === "percent" && !(c.value > 0 && c.value <= 100)) return { ok: false, error: "Percent must be between 1 and 100" };
  if (c.kind === "fixed" && !(c.value > 0)) return { ok: false, error: "Enter an amount greater than zero" };
  if (c.kind === "waive_head" && !c.headId) return { ok: false, error: "Choose the fee head to waive" };
  CONCESSIONS.push({ ...c, name, id: uid("cn-") });
  touch();
  return { ok: true };
}
export function removeConcession(id: string) {
  const i = CONCESSIONS.findIndex((c) => c.id === id);
  if (i >= 0) CONCESSIONS.splice(i, 1);
  for (let k = ASSIGNMENTS.length - 1; k >= 0; k--) if (ASSIGNMENTS[k].concessionId === id) ASSIGNMENTS.splice(k, 1);
  touch();
}
export function assignConcession(studentId: string, concessionId: string, note: string, by: string): Result {
  if (!studentId) return { ok: false, error: "Choose a student" };
  if (!concessionId) return { ok: false, error: "Choose a concession" };
  if (note.trim().length < 3) return { ok: false, error: "Add a short note on why it was approved" };
  if (ASSIGNMENTS.some((a) => a.studentId === studentId && a.concessionId === concessionId)) return { ok: false, error: "This student already has this concession" };
  ASSIGNMENTS.push({ id: uid("sc"), studentId, concessionId, note: note.trim(), approvedBy: by, at: nowUTC() });
  touch();
  return { ok: true };
}
export function unassignConcession(id: string) {
  const i = ASSIGNMENTS.findIndex((a) => a.id === id);
  if (i >= 0) ASSIGNMENTS.splice(i, 1);
  touch();
}

export function saveLateRule(next: LateRule) { Object.assign(LATE_RULE, next); touch(); }

/* ---------- Invoice generation ---------- */
export interface RunInput { period: string; dueOn: string; headIds: string[]; classIds: string[]; }
interface Draft { studentId: string; items: InvoiceItem[]; hasConcession: boolean; prevPaise: number; prevInvoices: Invoice[]; }

function draftFor(studentId: string, classId: string, headIds: string[], period: string): Draft | null {
  const row = STRUCTURE[classId] ?? {};
  const fees = headIds.filter((h) => (row[h] ?? 0) > 0 && HEADS.some((x) => x.id === h));
  if (!fees.length) return null;
  const items: InvoiceItem[] = fees.map((h) => ({ id: uid("it"), label: `${headName(h)} fee`, amountPaise: row[h], kind: "fee" as const }));
  const feeTotal = items.reduce((a, i) => a + i.amountPaise, 0);
  let discounted = 0;
  for (const a of ASSIGNMENTS.filter((x) => x.studentId === studentId)) {
    const c = CONCESSIONS.find((x) => x.id === a.concessionId);
    if (!c) continue;
    const base = c.headId ? (fees.includes(c.headId) ? row[c.headId] : 0) : feeTotal;
    const raw = c.kind === "percent" ? Math.round((base * c.value) / 100) : c.kind === "fixed" ? c.value : base;
    const amount = Math.min(raw, base, feeTotal - discounted);
    if (amount > 0) { items.push({ id: uid("it"), label: c.name, amountPaise: -amount, kind: "discount" }); discounted += amount; }
  }
  const prevInvoices = INVOICES.filter((i) => i.studentId === studentId && !isClosed(i) && !samePeriod(i.period, period) && balanceOf(i) > 0);
  const prevPaise = prevInvoices.reduce((a, i) => a + balanceOf(i), 0);
  return { studentId, items, hasConcession: discounted > 0, prevPaise, prevInvoices };
}

function plan(input: RunInput) {
  const drafts: Draft[] = []; let skipped = 0;
  for (const s of STUDENTS) {
    if (s.status !== "active" || !input.classIds.includes(s.classId)) continue;
    if (INVOICES.some((i) => i.studentId === s.id && samePeriod(i.period, input.period))) { skipped++; continue; }
    const d = draftFor(s.id, s.classId, input.headIds, input.period);
    if (d) drafts.push(d); else skipped++;
  }
  return { drafts, skipped };
}

export interface RunPreview { students: number; skipped: number; totalPaise: number; discountPaise: number; withConcessions: number; withPrevDues: number; prevDuesPaise: number; }
/** Counts and totals for the run, without changing anything. */
export function previewInvoiceRun(input: RunInput): RunPreview {
  const { drafts, skipped } = plan(input);
  const sum = (d: Draft) => d.items.reduce((a, i) => a + i.amountPaise, 0) + d.prevPaise;
  return {
    students: drafts.length, skipped, totalPaise: drafts.reduce((a, d) => a + sum(d), 0),
    discountPaise: drafts.reduce((a, d) => a + d.items.filter((i) => i.kind === "discount").reduce((x, i) => x - i.amountPaise, 0), 0),
    withConcessions: drafts.filter((d) => d.hasConcession).length,
    withPrevDues: drafts.filter((d) => d.prevPaise > 0).length, prevDuesPaise: drafts.reduce((a, d) => a + d.prevPaise, 0),
  };
}

/** Creates one invoice per active student without an invoice for the period. Closes older invoices whose balance is carried forward. */
export function generateInvoices(input: RunInput & { by?: string }): InvoiceRun {
  const { drafts, skipped } = plan(input);
  let n = nextNumber(INVOICES.map((i) => i.no), 3000);
  for (const d of drafts) {
    const no = `INV-${n++}`;
    const items = [...d.items];
    if (d.prevPaise > 0) items.push({ id: uid("it"), label: "Previous dues", amountPaise: d.prevPaise, kind: "carried_forward" });
    d.prevInvoices.forEach((p) => closedInto.set(p.id, no));
    INVOICES.push(settle({ id: uid("inv"), no, studentId: d.studentId, period: input.period.trim(), dueOn: input.dueOn, items, payments: [], totalPaise: 0, paidPaise: 0 }));
  }
  const run: InvoiceRun = {
    id: uid("run"), period: input.period.trim(), dueOn: input.dueOn, at: nowUTC(), by: input.by ?? "Staff", created: drafts.length, skipped,
    totalPaise: drafts.reduce((a, d) => a + d.items.reduce((x, i) => x + i.amountPaise, 0) + d.prevPaise, 0), classIds: [...input.classIds], headIds: [...input.headIds],
  };
  RUNS.unshift(run);
  touch();
  logAudit({ category: "fees", action: "invoices.generated", summary: `Generated ${run.period} invoices: ${run.created} invoices, ${formatINR(run.totalPaise)}${run.skipped ? `, ${run.skipped} skipped` : ""}`, entity: run.period, href: "/fees", sensitive: true });
  return run;
}

/* ---------- Late fee ---------- */
export function lateFeeFor(inv: Invoice, todayOn: string): number {
  if (!LATE_RULE.enabled || isClosed(inv) || waivers.has(inv.id) || balanceOf(inv) <= 0) return 0;
  const late = daysBetween(inv.dueOn, todayOn) - LATE_RULE.graceDays;
  if (late <= 0) return 0;
  const raw = LATE_RULE.per === "once" ? LATE_RULE.amountPaise : LATE_RULE.amountPaise * late;
  return LATE_RULE.maxPaise > 0 ? Math.min(raw, LATE_RULE.maxPaise) : raw;
}
/** Adds or updates the late fee line on every overdue open invoice. Returns how many invoices changed. */
export function applyLateFees(todayOn: string): number {
  let changed = 0;
  for (const inv of INVOICES) {
    const fee = lateFeeFor(inv, todayOn);
    if (fee <= 0) continue;
    const line = inv.items.find((i) => i.kind === "late_fee");
    if (line && line.amountPaise === fee) continue;
    if (line) line.amountPaise = fee; else inv.items.push({ id: uid("it"), label: "Late fee", amountPaise: fee, kind: "late_fee" });
    settle(inv); changed++;
  }
  if (changed) touch();
  return changed;
}
export function waiveLateFee(inv: Invoice, reason: string, by: string): Result {
  const line = inv.items.find((i) => i.kind === "late_fee" && i.amountPaise > 0);
  if (!line) return { ok: false, error: "This invoice has no late fee" };
  if (reason.trim().length < 5) return { ok: false, error: "Enter a reason of at least 5 characters" };
  waivers.set(inv.id, { reason: reason.trim(), by, at: nowUTC(), amountPaise: line.amountPaise });
  const was = line.amountPaise;
  line.amountPaise = 0; line.label = "Late fee (waived)";
  settle(inv); touch();
  logAudit({ category: "fees", action: "latefee.waived", summary: `Waived late fee of ${formatINR(was)} on ${inv.no}. Reason: ${reason.trim()}`, entity: inv.no, href: "/fees", sensitive: true, changes: [{ field: "Late fee", from: formatINR(was), to: formatINR(0) }] });
  return { ok: true };
}

/* ---------- Payments ---------- */
let receiptSeq = nextNumber(INVOICES.flatMap((i) => i.payments.map((p) => p.receiptNo)), 4000);
export function addPayment(inv: Invoice, p: { amountPaise: number; mode: FeeMode; reference?: string; at?: string; by: string }): Result & { payment?: FeePayment } {
  if (isClosed(inv)) return { ok: false, error: "This invoice is closed. Its balance moved to the next invoice." };
  const due = balanceOf(inv);
  if (!Number.isInteger(p.amountPaise) || p.amountPaise <= 0) return { ok: false, error: "Enter an amount greater than zero" };
  if (p.amountPaise > due) return { ok: false, error: "The amount is more than the balance" };
  const payment: FeePayment = { id: uid("pay"), receiptNo: `RCP-${receiptSeq++}`, amountPaise: p.amountPaise, mode: p.mode, reference: p.reference?.trim() || undefined, at: p.at ?? nowUTC(), receivedBy: p.by, status: "active" };
  inv.payments.push(payment);
  settle(inv); touch();
  logAudit({ category: "fees", action: "payment.recorded", summary: `Recorded ${formatINR(payment.amountPaise)} (${payment.mode.replace("_", " ")}) for ${STUDENTS.find((x) => x.id === inv.studentId)?.name ?? "a student"} against ${inv.no}, receipt ${payment.receiptNo}`, entity: inv.no, href: "/fees" });
  return { ok: true, payment };
}
export function cancelPayment(inv: Invoice, paymentId: string, reason: string, by: string): Result {
  const p = inv.payments.find((x) => x.id === paymentId);
  if (!p) return { ok: false, error: "Payment not found" };
  if (p.status === "cancelled") return { ok: false, error: "This payment is already cancelled" };
  if (reason.trim().length < 5) return { ok: false, error: "Enter a reason of at least 5 characters" };
  const before = balanceOf(inv);
  p.status = "cancelled"; p.cancelReason = reason.trim(); p.cancelledAt = nowUTC(); cancelledBy.set(p.id, by);
  settle(inv); touch();
  logAudit({ category: "fees", action: "payment.cancelled", summary: `Cancelled payment ${p.receiptNo} of ${formatINR(p.amountPaise)} for ${STUDENTS.find((x) => x.id === inv.studentId)?.name ?? "a student"}. Reason: ${reason.trim()}`, entity: inv.no, href: "/fees", sensitive: true, changes: [{ field: "Payment status", from: "Active", to: "Cancelled" }, { field: "Balance", from: formatINR(before), to: formatINR(balanceOf(inv)) }] });
  return { ok: true };
}

export const invoicesOf = (studentId: string) => INVOICES.filter((i) => i.studentId === studentId);
