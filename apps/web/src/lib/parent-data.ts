/** Demo data for the parent view. Derived from the same shapes as the real API will return. */
import { HOLIDAYS, INVOICES, SUBJECTS, type Student } from "./mock";

export type DayMark = "present" | "absent" | "half" | "leave" | "holiday" | "none";

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const dow = (dateOn: string) => new Date(`${dateOn}T00:00:00Z`).getUTCDay();

export function markFor(studentId: string, dateOn: string, todayOn: string): DayMark {
  if (dow(dateOn) === 0) return "holiday";
  if (HOLIDAYS.some((h) => h.kind === "holiday" && dateOn >= h.fromOn && dateOn <= h.toOn)) return "holiday";
  if (dateOn > todayOn) return "none";
  const r = hash(studentId + dateOn) % 100;
  // Mondays and Saturdays run a little higher, as in real schools.
  const a = dow(dateOn) === 1 ? 9 : dow(dateOn) === 6 ? 8 : 4;
  return r < a ? "absent" : r < a + 4 ? "half" : r < a + 6 ? "leave" : "present";
}

export function monthDays(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
}

export function monthStats(studentId: string, ym: string, todayOn: string) {
  const marks = monthDays(ym).map((d) => markFor(studentId, d, todayOn));
  const present = marks.filter((x) => x === "present").length, absent = marks.filter((x) => x === "absent").length;
  const half = marks.filter((x) => x === "half").length, leave = marks.filter((x) => x === "leave").length;
  const working = present + absent + half + leave;
  return { present, absent, half, leave, working, pct: working ? Math.round(((present + half * 0.5) / working) * 1000) / 10 : 0 };
}

export function resultsFor(s: Student) {
  const n = Number(s.id.replace("st", ""));
  const subjects = SUBJECTS.map((name, i) => ({ name, max: 100, marks: 52 + ((n * 13 + i * 17) % 46) }));
  const total = subjects.reduce((a, x) => a + x.marks, 0);
  return [{ id: `${s.id}-e1`, exam: "Unit Test 2", publishedAt: "2026-10-29T06:30:00Z", subjects, total, max: subjects.length * 100, pct: Math.round((total / (subjects.length * 100)) * 1000) / 10, remark: "Steady progress. Keep revising Mathematics." }];
}

export const invoiceFor = (s: Student) => INVOICES.find((i) => i.studentId === s.id);
export const siblingsOf = (children: Student[]) => children;
export const gradeOf = (pct: number) => (pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 40 ? "D" : "E");
