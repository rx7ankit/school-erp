"use client";
/**
 * Teacher assignments (docs/erd.md "class_staff"). The source of truth is STAFF[].classes in mock.ts,
 * so attendance, timetable, results and messaging see a change on their next render.
 * Every change is audit logged.
 */
import * as React from "react";
import { STAFF, className, type StaffRow } from "./mock";
import { logAudit } from "./audit";

type Entry = StaffRow["classes"][number];

let version = 0;
const subs = new Set<() => void>();
const bump = () => { version += 1; subs.forEach((f) => f()); };
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
/** Re-renders the caller whenever an assignment changes. Returns a version number. */
export function useAssignments(): number { return React.useSyncExternalStore(subscribe, () => version, () => version); }
/** Tell subscribers that classes or subjects changed (they may add or drop assignments). */
export const touchAssignments = bump;

export const classTeacherOf = (classId: string): StaffRow | undefined => STAFF.find((s) => s.classes.some((e) => e.classId === classId && e.role === "class_teacher"));
export const subjectTeacherOf = (classId: string, subject: string): StaffRow | undefined => STAFF.find((s) => s.classes.some((e) => e.classId === classId && e.subject === subject));
/** Other classes this person is class teacher of. */
export const classTeacherOfClasses = (staffId: string): string[] => STAFF.find((s) => s.id === staffId)?.classes.filter((e) => e.role === "class_teacher").map((e) => e.classId) ?? [];
export const assignmentCount = (classId: string): number => STAFF.reduce((n, s) => n + s.classes.filter((e) => e.classId === classId).length, 0);
/** What a person does: every class with its role and subject. */
export const assignmentsOf = (staffId: string): Entry[] => STAFF.find((s) => s.id === staffId)?.classes ?? [];

/** Hint shown next to a name in the dropdowns. */
export const staffHint = (s: StaffRow) => s.department !== "Administration" ? s.department : s.designation;

function change(action: string, category: "staff" | "academic", summary: string, entity: string, field: string, from: string, to: string, sensitive: boolean) {
  logAudit({ category, action, summary, entity, sensitive, changes: [{ field, from, to }] });
}

/** Make `staffId` the class teacher of the class. The previous class teacher keeps any subject they teach there. */
export function setClassTeacher(classId: string, staffId: string | null) {
  const prev = classTeacherOf(classId);
  const next = staffId ? STAFF.find((s) => s.id === staffId) : undefined;
  if ((prev?.id ?? null) === (next?.id ?? null)) return;
  if (prev) prev.classes = prev.classes.flatMap<Entry>((e) => (e.classId === classId && e.role === "class_teacher" ? (e.subject ? [{ ...e, role: "subject_teacher" }] : []) : [e]));
  if (next) {
    const i = next.classes.findIndex((e) => e.classId === classId);
    next.classes = i >= 0 ? next.classes.map((e, k) => (k === i ? { ...e, role: "class_teacher" } : e)) : [...next.classes, { classId, role: "class_teacher" }];
  }
  bump();
  const [from, to] = [prev?.name ?? "Nobody", next?.name ?? "Nobody"];
  change("classteacher.changed", "staff", `Changed class teacher of Class ${className(classId)} from ${from} to ${to}`, `Class ${className(classId)}`, `Class teacher, ${className(classId)}`, from, to, true);
}

/** Make `staffId` teach `subject` in the class (null clears it). The previous teacher stops teaching it there. */
export function setSubjectTeacher(classId: string, subject: string, staffId: string | null) {
  const prev = subjectTeacherOf(classId, subject);
  const next = staffId ? STAFF.find((s) => s.id === staffId) : undefined;
  if ((prev?.id ?? null) === (next?.id ?? null)) return;
  if (prev) prev.classes = prev.classes.flatMap<Entry>((e) => (e.classId === classId && e.subject === subject ? (e.role === "class_teacher" ? [{ classId, role: e.role }] : []) : [e]));
  if (next) {
    const i = next.classes.findIndex((e) => e.classId === classId && !e.subject);
    next.classes = i >= 0 ? next.classes.map((e, k) => (k === i ? { ...e, subject } : e)) : [...next.classes, { classId, role: "subject_teacher", subject }];
  }
  bump();
  const [from, to] = [prev?.name ?? "Not assigned", next?.name ?? "Not assigned"];
  change("subjectteacher.changed", "academic", `Changed ${subject} teacher of Class ${className(classId)} from ${from} to ${to}`, `Class ${className(classId)}`, `${subject} teacher, ${className(classId)}`, from, to, false);
}

/** A subject was renamed: keep every teacher assignment attached to it. */
export function renameSubjectAssignments(from: string, to: string) {
  if (from === to) return;
  STAFF.forEach((s) => { s.classes = s.classes.map((e) => (e.subject === from ? { ...e, subject: to } : e)); });
  bump();
}
/** A subject left a class (or the school): drop the teacher assignments for it. Class teachers stay class teachers. */
export function dropSubjectAssignments(subject: string, classIds?: string[]) {
  STAFF.forEach((s) => {
    s.classes = s.classes.flatMap<Entry>((e) => {
      if (e.subject !== subject || (classIds && !classIds.includes(e.classId))) return [e];
      return e.role === "class_teacher" ? [{ classId: e.classId, role: e.role }] : [];
    });
  });
  bump();
}

/** How complete a class is: a class teacher plus a teacher for every subject it studies. */
export function classSlots(classId: string, subjectNames: string[]) {
  const missing = subjectNames.filter((s) => !subjectTeacherOf(classId, s));
  const ct = !!classTeacherOf(classId);
  return { total: 1 + subjectNames.length, filled: (ct ? 1 : 0) + subjectNames.length - missing.length, missing, ct, complete: ct && missing.length === 0 };
}
