"use client";
/**
 * After Apply: the "what is left" checklist. Lives in memory with the rest of the demo data.
 * Items with a live rule (empty teacher slots, transfer certificates...) tick themselves; the rest are ticked by hand.
 */
import * as React from "react";
import { classSlots } from "./assignments";
import { getAcademic, subjectName } from "./academic-setup";
import { RUNS } from "./fees-setup";
import { CLASSES } from "./mock";
import { getRecord } from "./student-record";
import type { ChecklistItem, RolloverResult } from "./rollover-types";

let last: RolloverResult | null = null;
let manual = new Set<string>();
let version = 0;
const subs = new Set<() => void>();
const bump = () => { version += 1; subs.forEach((f) => f()); };
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };

export const getLastResult = () => last;
export function setLastResult(r: RolloverResult) { last = r; manual = new Set(); bump(); }
export function markChecklistDone(id: string) { manual = new Set([...manual, id]); bump(); }
/** Re-renders when a rollover is applied or an item is ticked. Also pass a store version so live rules refresh. */
export function useLastResult(): RolloverResult | null {
  return React.useSyncExternalStore(subscribe, () => last, () => null);
}
export function useChecklistVersion(): number { return React.useSyncExternalStore(subscribe, () => version, () => 0); }

export interface ChecklistRow extends ChecklistItem { done: boolean; count: number; text: string; }

/** Empty teacher slots across the classes of the current year. */
export function emptySlots(): number {
  const acad = getAcademic();
  return CLASSES.reduce((n, c) => { const s = classSlots(c.id, (acad.classSubjects[c.id] ?? []).map(subjectName)); return n + (s.total - s.filled); }, 0);
}

export function checklistRows(r: RolloverResult): ChecklistRow[] {
  return r.checklist.map((it): ChecklistRow => {
    switch (it.id) {
      case "teachers": { const n = emptySlots(); return { ...it, count: n, done: n === 0, text: n ? `Assign teachers to ${n} empty ${n === 1 ? "slot" : "slots"}` : "All teacher slots are filled" }; }
      case "invoices": {
        const done = RUNS.some((x) => x.at >= r.appliedAt);
        return { ...it, count: done ? 0 : 1, done, text: done ? (r.invoicePeriod ? `${r.invoicePeriod} invoices created for ${r.invoicesCreated} students` : "First invoices created") : it.title };
      }
      case "certificates": {
        const n = r.leavingIds.filter((id) => !getRecord(id).certificates.some((c) => c.kind === "transfer")).length;
        return { ...it, count: n, done: n === 0, text: n ? `Issue transfer certificates for ${n} ${n === 1 ? "student" : "students"} who left` : "Transfer certificates are issued" };
      }
      default: { const done = manual.has(it.id); return { ...it, count: done ? 0 : 1, done, text: it.title }; }
    }
  });
}
