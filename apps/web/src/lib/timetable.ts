"use client";
import * as React from "react";
import { CLASSES, STAFF, type StaffRow } from "./mock";

/**
 * Timetable and substitutes (demo store). Defaults are generated from STAFF; edits and substitutions
 * are kept in localStorage so every tab sees them. Period times are IST clock strings ("HH:mm"), never zone-converted.
 * Weekdays are 1 (Mon) to 6 (Sat).
 */
export interface Period { id: string; name: string; start: string; end: string; isBreak?: boolean; }
export interface Slot { classId: string; weekday: number; periodId: string; subject: string; staffId: string; }
export interface Substitution { dateOn: string; classId: string; periodId: string; absentStaffId: string; substituteStaffId: string; }

export const PERIODS: Period[] = [
  { id: "p1", name: "Period 1", start: "08:00", end: "08:40" },
  { id: "p2", name: "Period 2", start: "08:40", end: "09:20" },
  { id: "p3", name: "Period 3", start: "09:20", end: "10:00" },
  { id: "brk", name: "Break", start: "10:00", end: "10:20", isBreak: true },
  { id: "p4", name: "Period 4", start: "10:20", end: "11:00" },
  { id: "p5", name: "Period 5", start: "11:00", end: "11:40" },
  { id: "p6", name: "Period 6", start: "11:40", end: "12:20" },
  { id: "p7", name: "Period 7", start: "12:20", end: "13:00" },
];
export const TEACHING_PERIODS = PERIODS.filter((p) => !p.isBreak);
export const WEEKDAYS = [{ n: 1, short: "Mon", long: "Monday" }, { n: 2, short: "Tue", long: "Tuesday" }, { n: 3, short: "Wed", long: "Wednesday" }, { n: 4, short: "Thu", long: "Thursday" }, { n: 5, short: "Fri", long: "Friday" }, { n: 6, short: "Sat", long: "Saturday" }];
export const TIMETABLE_CLASSES = CLASSES;

/** 1 (Mon) to 6 (Sat), 0 for Sunday. Calendar dates carry no zone. */
export const weekdayOf = (dateOn: string) => new Date(`${dateOn}T00:00:00Z`).getUTCDay();
export const periodById = (id: string) => PERIODS.find((p) => p.id === id);
export const staffById = (id: string): StaffRow | undefined => STAFF.find((s) => s.id === id);
export const staffName = (id: string) => staffById(id)?.name ?? "—";

/** Subject a teacher teaches, from their class assignments. */
export const subjectOf = (t: StaffRow) => t.classes.find((c) => c.subject)?.subject;
/** People who can teach a period: anyone with a class assignment. */
export const teachers = () => STAFF.filter((t) => t.classes.length > 0);

/* ---------- defaults ---------- */
const SUBJECT_ORDER = ["Mathematics", "English", "Hindi", "Science", "Social Science", "Computer"];
function defaultSlots(): Slot[] {
  const out: Slot[] = [];
  const byClass = (subject: string, classId: string) =>
    STAFF.find((t) => t.classes.some((c) => c.classId === classId && c.subject === subject)) ?? STAFF.find((t) => subjectOf(t) === subject);
  CLASSES.forEach((c, ci) => {
    for (const weekday of [1, 2, 3, 4, 5, 6]) {
      TEACHING_PERIODS.forEach((p, k) => {
        if ((ci * 3 + k * 2 + weekday) % 7 < 2) return; // a free period
        const subject = SUBJECT_ORDER[(ci + k + weekday) % SUBJECT_ORDER.length];
        const t = byClass(subject, c.id);
        if (t) out.push({ classId: c.id, weekday, periodId: p.id, subject, staffId: t.id });
      });
    }
  });
  return out;
}
const DEFAULT_SLOTS = defaultSlots();

/* ---------- storage ---------- */
interface Persisted { slots?: Slot[]; subs?: Substitution[]; }
const KEY = "scool.timetable";
const EVT = "scool:timetable";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const raw = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
let cache: { s: string; v: Persisted } = { s: "", v: {} };
function state(): Persisted {
  if (typeof window === "undefined") return {};
  const s = raw();
  if (s !== cache.s) { let v: Persisted = {}; try { v = s ? (JSON.parse(s) as Persisted) : {}; } catch {} cache = { s, v }; }
  return cache.v;
}
function write(p: Persisted) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
  window.dispatchEvent(new Event(EVT));
}
/** Re-render when the timetable or substitutions change in any tab. Call the query functions after it. */
export function useTimetable(): string { return React.useSyncExternalStore(subscribe, raw, () => ""); }

const allSlots = () => state().slots ?? DEFAULT_SLOTS;
export const allSubstitutions = () => state().subs ?? [];

/* ---------- queries ---------- */
export const slotsForClass = (classId: string) => allSlots().filter((s) => s.classId === classId);
export const slotsForTeacher = (staffId: string, weekday: number) => allSlots().filter((s) => s.staffId === staffId && s.weekday === weekday);
export const slotAt = (classId: string, weekday: number, periodId: string) => allSlots().find((s) => s.classId === classId && s.weekday === weekday && s.periodId === periodId);
/** Other classes where this teacher already has this period (for the clash warning). */
export const clashes = (staffId: string, weekday: number, periodId: string, exceptClassId: string) =>
  allSlots().filter((s) => s.staffId === staffId && s.weekday === weekday && s.periodId === periodId && s.classId !== exceptClassId);
export const substitutionFor = (dateOn: string, classId: string, periodId: string) =>
  allSubstitutions().find((x) => x.dateOn === dateOn && x.classId === classId && x.periodId === periodId);
/** Teachers marked absent today. Absence is the `absentToday` flag on STAFF. */
export const absentTeachers = () => STAFF.filter((t) => t.absentToday && t.classes.length > 0);

/** Teachers with no class in this period on this date, not absent and not already covering another class. */
export function freeTeachers(dateOn: string, periodId: string): StaffRow[] {
  const wd = weekdayOf(dateOn);
  const covering = new Set(allSubstitutions().filter((x) => x.dateOn === dateOn && x.periodId === periodId).map((x) => x.substituteStaffId));
  return teachers().filter((t) => !t.absentToday && !covering.has(t.id) && !allSlots().some((s) => s.staffId === t.id && s.weekday === wd && s.periodId === periodId));
}

export interface CoverRow { slot: Slot; absent: StaffRow; sub?: Substitution; }
/** Periods of absent teachers on this date that someone has to cover, in period order. */
export function needsCover(dateOn: string): CoverRow[] {
  const wd = weekdayOf(dateOn);
  if (wd === 0) return [];
  return absentTeachers().flatMap((t) => slotsForTeacher(t.id, wd).map((slot) => ({ slot, absent: t, sub: substitutionFor(dateOn, slot.classId, slot.periodId) })))
    .sort((a, b) => TEACHING_PERIODS.findIndex((p) => p.id === a.slot.periodId) - TEACHING_PERIODS.findIndex((p) => p.id === b.slot.periodId) || a.slot.classId.localeCompare(b.slot.classId));
}
export const uncoveredCount = (dateOn: string) => needsCover(dateOn).filter((r) => !r.sub).length;

export interface DayRow { period: Period; classId: string; subject: string; kind: "own" | "cover"; /** Name of the person it is shared with: who covers my class, or whom I am covering. */ other?: string; }
/** A teacher's day: their own periods plus the ones they cover, in period order. */
export function dayForTeacher(dateOn: string, staffId: string): DayRow[] {
  const wd = weekdayOf(dateOn);
  if (wd === 0) return [];
  const own = slotsForTeacher(staffId, wd).map((s): DayRow => {
    const sub = substitutionFor(dateOn, s.classId, s.periodId);
    return { period: periodById(s.periodId)!, classId: s.classId, subject: s.subject, kind: "own", other: sub ? staffName(sub.substituteStaffId) : undefined };
  });
  const cover = allSubstitutions().filter((x) => x.dateOn === dateOn && x.substituteStaffId === staffId).map((x): DayRow => ({
    period: periodById(x.periodId)!, classId: x.classId, subject: allSlots().find((s) => s.classId === x.classId && s.weekday === wd && s.periodId === x.periodId)?.subject ?? "Cover", kind: "cover", other: staffName(x.absentStaffId),
  }));
  const order = (r: DayRow) => PERIODS.findIndex((p) => p.id === r.period.id);
  return [...own, ...cover].sort((a, b) => order(a) - order(b));
}

/* ---------- changes ---------- */
export function assignSubstitute(sub: Substitution) {
  const rest = allSubstitutions().filter((x) => !(x.dateOn === sub.dateOn && x.classId === sub.classId && x.periodId === sub.periodId));
  write({ ...state(), subs: [...rest, sub] });
}
export function removeSubstitute(dateOn: string, classId: string, periodId: string) {
  write({ ...state(), subs: allSubstitutions().filter((x) => !(x.dateOn === dateOn && x.classId === classId && x.periodId === periodId)) });
}
/** Set or clear (subject and staffId null) one cell. */
export function setSlot(classId: string, weekday: number, periodId: string, value: { subject: string; staffId: string } | null) {
  const rest = allSlots().filter((s) => !(s.classId === classId && s.weekday === weekday && s.periodId === periodId));
  write({ ...state(), slots: value ? [...rest, { classId, weekday, periodId, ...value }] : rest });
}

/* ---------- clock ---------- */
/** Current IST clock time as "HH:mm". */
export function nowHHmm(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}
const tick = (cb: () => void) => { const i = setInterval(cb, 30_000); return () => clearInterval(i); };
/** IST "HH:mm", refreshed every 30 seconds. Empty during server render. */
export function useNowIST(): string { return React.useSyncExternalStore(tick, () => nowHHmm(), () => ""); }
/** Index of the period that is on now or comes next, or -1 when the day is over. */
export function nextRowIndex(rows: { period: Period }[], now: string): number {
  return now ? rows.findIndex((r) => r.period.end > now) : -1;
}
