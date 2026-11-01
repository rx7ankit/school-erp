import { currentYear, getAcademic } from "./academic-setup";
import { CONCESSIONS } from "./fees-setup";
import { nowUTC } from "./time";
import type { RolloverDraft } from "./rollover-types";

const addYears = (dateOn: string, n: number) => { const d = new Date(`${dateOn}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + n); return d.toISOString().slice(0, 10); };
const addDays = (dateOn: string, n: number) => { const d = new Date(`${dateOn}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** "2026-27" becomes "2027-28". */
export function nextYearLabel(label: string): string {
  const start = Number(label.slice(0, 4)) + 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/**
 * Everything prefilled from the state of the school today. Students all promote (the last grade completes school),
 * each class moves to the same section of the next grade, teachers stay with the same class, fees follow the new grade.
 */
export function buildDefaults(by: string, focusClassId?: string): RolloverDraft {
  const cur = currentYear();
  const label = nextYearLabel(cur.label);
  const prepared = getAcademic().years.find((y) => y.label === label && y.status !== "completed");
  const fromOn = prepared?.fromOn ?? addDays(cur.toOn, 1);
  const toOn = prepared?.toOn ?? addYears(cur.toOn, 1);
  return {
    version: 1, id: `ro-${Date.now().toString(36)}`, fromYearId: cur.id, fromLabel: cur.label,
    step: focusClassId ? 1 : 0, savedAt: nowUTC(), savedBy: by,
    decisions: {}, dest: {}, keepOrder: false, focusClassId,
    year: { label, fromOn, toOn },
    extraClasses: [], removedClasses: [], capacity: {},
    newSubjects: [], classSubjects: {},
    teacherMode: "same", teachers: {}, timetable: "copy",
    fees: {
      newHeads: [], removedHeads: [], grid: {},
      carry: Object.fromEntries(CONCESSIONS.map((c) => [c.id, /rte|staff|sibling/i.test(c.name)])),
      dues: "carry", writeoffReason: "", invoices: "later",
      period: `Term 1 ${label}`, dueOn: addDays(fromOn, 14),
    },
    ack: false,
  };
}
