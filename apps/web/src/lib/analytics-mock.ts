/** Analytics derived from the same records the real backend stores. Demo data only. */
import { CLASSES, HOLIDAYS, STAFF, STUDENTS, SUBJECTS, className, type StaffRow } from "./mock";
import { markFor, resultsFor, type DayMark } from "./parent-data";
import { sharedRatingFor } from "./feedback-mock";

const VALUE: Record<DayMark, number> = { present: 1, half: 0.5, absent: 0, leave: 0, holiday: 0, none: 0 };
const counted = (m: DayMark) => m === "present" || m === "half" || m === "absent" || m === "leave";
const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const active = (classIds: string[]) => STUDENTS.filter((s) => classIds.includes(s.classId) && s.status === "active");

/** The last `n` school days up to today, oldest first. Sundays and holidays are skipped. */
export function workingDays(todayOn: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${todayOn}T00:00:00Z`);
  while (out.length < n) {
    const on = d.toISOString().slice(0, 10);
    const holiday = HOLIDAYS.some((h) => h.kind === "holiday" && on >= h.fromOn && on <= h.toOn);
    if (dow(on) !== 0 && !holiday) out.push(on);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

const pct = (marks: DayMark[]) => {
  const c = marks.filter(counted);
  return c.length ? (c.reduce((a, m) => a + VALUE[m], 0) / c.length) * 100 : 0;
};
const round1 = (v: number) => Math.round(v * 10) / 10;
const marksOf = (ids: string[], days: string[], today: string) => active(ids).flatMap((s) => days.map((d) => markFor(s.id, d, today)));

export function attendanceSummary(classIds: string[], today: string, n = 20) {
  const days = workingDays(today, n);
  const rows = active(classIds).map((s) => ({ s, pct: round1(pct(days.map((d) => markFor(s.id, d, today)))) }));
  const all = marksOf(classIds, days, today);
  return {
    days, avg: round1(pct(all)),
    absentToday: active(classIds).filter((s) => markFor(s.id, days[days.length - 1], today) === "absent").length,
    halfDays: all.filter((m) => m === "half").length,
    atRisk: rows.filter((r) => r.pct < 75).sort((a, b) => a.pct - b.pct),
    students: rows,
  };
}
export const attendanceTrend = (classIds: string[], today: string, n = 20) =>
  workingDays(today, n).map((d) => ({ label: `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`, value: round1(pct(marksOf(classIds, [d], today))) }));
export const attendanceByClass = (classIds: string[], today: string, n = 20) =>
  classIds.map((id) => ({ label: `Class ${className(id)}`, value: round1(pct(marksOf([id], workingDays(today, n), today))) })).sort((a, b) => b.value - a.value);
export function attendanceByWeekday(classIds: string[], today: string) {
  const days = workingDays(today, 48);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, i) => ({ label, value: round1(pct(marksOf(classIds, days.filter((d) => dow(d) === i + 1), today))) }));
}
export function heatmap(classId: string, today: string, n = 14) {
  const days = workingDays(today, n);
  return { days, rows: active([classId]).map((s) => ({ name: s.name, marks: days.map((d) => markFor(s.id, d, today)) })) };
}

/* ---------- Results ---------- */
export function resultsSummary(classIds: string[]) {
  const sts = active(classIds);
  const res = sts.map((s) => ({ s, r: resultsFor(s)[0] }));
  const subjects = SUBJECTS.map((name) => {
    const v = res.map((x) => x.r.subjects.find((y) => y.name === name)!.marks);
    return { label: name, value: round1(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)) };
  });
  const bands = [["A+ (90+)", 90, 101], ["A (80s)", 80, 90], ["B (70s)", 70, 80], ["C (60s)", 60, 70], ["D (40s)", 40, 60], ["Below 40", 0, 40]] as const;
  const spread = bands.map(([label, lo, hi]) => ({ label, value: res.filter((x) => x.r.pct >= lo && x.r.pct < hi).length }));
  const classes = classIds.map((id) => {
    const p = res.filter((x) => x.s.classId === id).map((x) => x.r.pct);
    return { label: `Class ${className(id)}`, value: round1(p.reduce((a, b) => a + b, 0) / Math.max(1, p.length)) };
  }).sort((a, b) => b.value - a.value);
  const sorted = [...res].sort((a, b) => b.r.pct - a.r.pct);
  return {
    avg: round1(res.reduce((a, x) => a + x.r.pct, 0) / Math.max(1, res.length)),
    passRate: round1((res.filter((x) => x.r.pct >= 40).length / Math.max(1, res.length)) * 100),
    subjects, spread, classes,
    top: sorted.slice(0, 5).map((x) => ({ name: x.s.name, cls: className(x.s.classId), pct: x.r.pct })),
    support: sorted.slice(-5).reverse().map((x) => ({ name: x.s.name, cls: className(x.s.classId), pct: x.r.pct })),
  };
}

/* ---------- Teachers ---------- */
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 5);
export interface TeacherRow { staff: StaffRow; subject: string; classes: string; resultAvg: number | null; attendancePct: number; leaveDays: number; rating: number | null; }
export function teacherRows(): TeacherRow[] {
  return STAFF.filter((s) => s.classes.length > 0).map((t) => {
    const subject = t.classes[0].subject ?? "General";
    const sts = active(t.classes.map((c) => c.classId));
    const marks = sts.map((s) => resultsFor(s)[0].subjects.find((x) => x.name === subject)?.marks).filter((x): x is number => x !== undefined);
    const leave = (hash(t.id) % 4) + (t.absentToday ? 1 : 0);
    return {
      staff: t, subject, classes: t.classes.map((c) => className(c.classId)).join(", "),
      resultAvg: marks.length ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : null,
      attendancePct: round1(((26 - leave) / 26) * 100), leaveDays: leave, rating: sharedRatingFor(t.id),
    };
  });
}
export const allClassIds = () => CLASSES.map((c) => c.id);
