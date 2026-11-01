"use client";
/**
 * Academic setup demo store (module level, resets on a full reload).
 * Shapes follow docs/erd.md "Academic setup": academic_years, classes, subjects, class_subjects,
 * grading_schemes + grade_bands, exams + exam_subjects, plus marks, remarks and publishing state.
 */
import * as React from "react";
import { CLASSES, STUDENTS, className, type ClassRow } from "./mock";
import { logAudit, type AuditChange } from "./audit";
import { assignmentCount, dropSubjectAssignments, renameSubjectAssignments, touchAssignments } from "./assignments";

export interface AcademicYear { id: string; label: string; fromOn: string; toOn: string; current: boolean; }
/** A class of the shared CLASSES list plus what only setup knows: capacity and the academic year it belongs to. */
export interface SetupClass extends ClassRow { capacity: number; yearId: string; }
export interface Subject { id: string; name: string; code: string; }
export interface GradeBand { min: number; grade: string; }
export interface GradingScheme { bands: GradeBand[]; floorGrade: string; passPercent: number; }
export interface ExamSubject { classId: string; subjectId: string; max: number; pass: number; }
export interface Exam { id: string; name: string; term: string; fromOn: string; toOn: string; classIds: string[]; subjects: ExamSubject[]; }
export interface Publication { at: string; }

interface State {
  years: AcademicYear[];
  classes: SetupClass[]; // derived from the shared CLASSES list on every change
  capacity: Record<string, number>; // classId -> students a section can hold
  classYear: Record<string, string>; // classId -> academic year id
  subjects: Subject[];
  classSubjects: Record<string, string[]>; // classId -> subjectIds
  scheme: GradingScheme;
  exams: Exam[];
  marks: Record<string, number>; // `${examId}|${subjectId}|${studentId}`
  remarks: Record<string, string>; // `${examId}|${studentId}`
  published: Record<string, Publication>; // `${examId}|${classId}`
}

export const DEFAULT_SCHEME: GradingScheme = {
  bands: [{ min: 90, grade: "A+" }, { min: 80, grade: "A" }, { min: 70, grade: "B+" }, { min: 60, grade: "B" }, { min: 50, grade: "C" }, { min: 40, grade: "D" }],
  floorGrade: "E", passPercent: 40,
};

const SUBJECTS_SEED: Subject[] = [
  { id: "sub-math", name: "Mathematics", code: "MAT" }, { id: "sub-eng", name: "English", code: "ENG" }, { id: "sub-hin", name: "Hindi", code: "HIN" },
  { id: "sub-sci", name: "Science", code: "SCI" }, { id: "sub-sst", name: "Social Science", code: "SST" }, { id: "sub-comp", name: "Computer", code: "CMP" },
];
const CORE = SUBJECTS_SEED.slice(0, 5).map((s) => s.id);
const classIds = CLASSES.map((c) => c.id as string);
const upper = (id: string) => ["c8a", "c8b", "c9a", "c10a"].includes(id);

const examSubjects = (ids: string[], withComputer: boolean, max: number): ExamSubject[] =>
  ids.flatMap((classId) => [...CORE, ...(withComputer && upper(classId) ? ["sub-comp"] : [])].map((subjectId) => ({ classId, subjectId, max: subjectId === "sub-comp" ? 50 : max, pass: Math.round((subjectId === "sub-comp" ? 50 : max) * 0.4) })));

const FIRST_YEAR = "y2026";
const initial = (): State => ({
  years: [
    { id: "y2026", label: "2026-27", fromOn: "2026-04-01", toOn: "2027-03-31", current: true },
    { id: "y2027", label: "2027-28", fromOn: "2027-04-01", toOn: "2028-03-31", current: false },
  ],
  classes: [], capacity: {}, classYear: {},
  subjects: SUBJECTS_SEED,
  classSubjects: Object.fromEntries(classIds.map((id) => [id, [...CORE, ...(upper(id) ? ["sub-comp"] : [])]])),
  scheme: DEFAULT_SCHEME,
  exams: [
    { id: "e1", name: "Unit Test 2", term: "Term 1", fromOn: "2026-10-12", toOn: "2026-10-17", classIds, subjects: examSubjects(classIds, false, 100) },
    { id: "e2", name: "Half-yearly", term: "Term 1", fromOn: "2026-11-23", toOn: "2026-12-04", classIds, subjects: examSubjects(classIds, true, 100) },
  ],
  marks: {}, remarks: {},
  published: Object.fromEntries(classIds.map((id) => [`e1|${id}`, { at: "2026-10-29T06:30:00Z" }])),
});

const sortShared = () => CLASSES.sort((a, b) => a.order - b.order || a.grade.localeCompare(b.grade) || a.section.localeCompare(b.section));
const withClasses = (s: State): State => ({ ...s, classes: CLASSES.map((c) => ({ ...c, capacity: s.capacity[c.id] ?? 40, yearId: s.classYear[c.id] ?? FIRST_YEAR })) });
let state: State = withClasses(initial());
function audit(action: string, summary: string, entity: string, changes?: AuditChange[]) { logAudit({ category: "academic", action, summary, entity, changes }); }
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => { state = withClasses({ ...state, ...patch }); subs.forEach((f) => f()); touchAssignments(); };
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export const getAcademic = () => state;
/** Live view of the store. Re-renders on every change. */
export function useAcademic(): State { return React.useSyncExternalStore(subscribe, () => state, () => state); }

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

/* ---------- Years ---------- */
export function addYear(label: string, fromOn: string, toOn: string): Result {
  if (!/^\d{4}-\d{2}$/.test(label)) return fail("Write the year as 2028-29.");
  if (state.years.some((y) => y.label === label)) return fail(`${label} already exists.`);
  if (!fromOn || !toOn || toOn <= fromOn) return fail("The end date must be after the start date.");
  set({ years: [...state.years, { id: uid("y"), label, fromOn, toOn, current: false }].sort((a, b) => a.fromOn.localeCompare(b.fromOn)) });
  audit("year.created", `Added academic year ${label} as a draft`, `Year ${label}`);
  return ok;
}
export function setCurrentYear(id: string) {
  const [from, to] = [currentYear().label, state.years.find((y) => y.id === id)?.label ?? ""];
  set({ years: state.years.map((y) => ({ ...y, current: y.id === id })) });
  if (from !== to) logAudit({ category: "academic", action: "year.changed", summary: `Changed the current academic year from ${from} to ${to}`, entity: "Academic year", sensitive: true, changes: [{ field: "Current year", from, to }] });
}
export const currentYear = () => state.years.find((y) => y.current) ?? state.years[0];

/* ---------- Classes and sections ---------- */
export const classLabel = (id: string) => className(id);
export const activeStudentsIn = (classId: string) => STUDENTS.filter((s) => s.classId === classId && s.status === "active");
const studentsEver = (classId: string) => STUDENTS.filter((s) => s.classId === classId).length;
export const isStandardGrade = (g: string) => /^(1[0-2]|[1-9])$/.test(g);
export const STANDARD_GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));

/** Sections of one grade (or custom class name), in order. */
export const sectionsOfGrade = (grade: string) => state.classes.filter((c) => c.grade === grade);
/** Names of the custom classes in use, in order. */
export const customClassNames = (): string[] => [...new Set(state.classes.filter((c) => c.custom).map((c) => c.grade))];
/** Suggest the next free section: A, B, C ... */
export function nextSection(grade: string): string {
  const used = new Set(sectionsOfGrade(grade).map((c) => c.section.toUpperCase()));
  for (let i = 0; i < 26; i++) { const l = String.fromCharCode(65 + i); if (!used.has(l)) return l; }
  return "";
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
function newClassId(grade: string, section: string): string {
  const base = `c${slug(grade)}${slug(section)}`; let id = base, n = 2;
  while (CLASSES.some((c) => c.id === id)) id = `${base}${n++}`;
  return id;
}
function checkSection(grade: string, section: string, capacity: number, selfId?: string): Result {
  if (!/^[A-Za-z0-9]{1,8}$/.test(section)) return fail("Section is a short name, for example A or B.");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) return fail("Capacity must be between 1 and 100.");
  if (CLASSES.some((c) => c.id !== selfId && c.grade.toLowerCase() === grade.toLowerCase() && c.section.toLowerCase() === section.toLowerCase())) return fail(`Class ${grade}-${section.toUpperCase()} already exists.`);
  return ok;
}
/** Sections copy the subject list of a sibling section; a first section of a standard grade starts with the core subjects. */
function defaultSubjects(grade: string, custom: boolean): string[] {
  const sibling = sectionsOfGrade(grade)[0];
  if (sibling) return [...(state.classSubjects[sibling.id] ?? [])];
  return custom ? [] : CORE.filter((s) => state.subjects.some((x) => x.id === s));
}
function create(grade: string, section: string, capacity: number, order: number, custom: boolean): string {
  const sec = section.length === 1 ? section.toUpperCase() : section.charAt(0).toUpperCase() + section.slice(1);
  const id = newClassId(grade, sec);
  const subjectsFor = defaultSubjects(grade, custom);
  CLASSES.push({ id, grade, section: sec, order, ...(custom ? { custom: true } : {}) });
  sortShared();
  set({ capacity: { ...state.capacity, [id]: capacity }, classYear: { ...state.classYear, [id]: currentYear().id }, classSubjects: { ...state.classSubjects, [id]: subjectsFor } });
  audit("class.created", `Created Class ${grade}-${sec} for ${currentYear().label}${custom ? " (custom class)" : ""}`, `Class ${grade}-${sec}`);
  return id;
}
/** Add a section to one of the standard grades 1 to 12. */
export function addSection(grade: string, section: string, capacity: number): Result {
  if (!isStandardGrade(grade)) return fail("Standard classes are grades 1 to 12. Use Custom class for others.");
  const r = checkSection(grade, section.trim(), capacity); if (!r.ok) return r;
  create(grade, section.trim(), capacity, Number(grade), false);
  return ok;
}
/** A school's own class (Nursery, LKG, KG-1...) with its first section. */
export function addCustomClass(name: string, order: number, section: string, capacity: number): Result {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) return fail("Give the class a name, for example Nursery.");
  if (n.length > 20) return fail("Keep the class name under 20 characters.");
  if (/^\d+$/.test(n) || /[-/]/.test(n)) return fail("Use a name such as Nursery or LKG. Grades 1 to 12 are already there.");
  if (!Number.isInteger(order) || order < -50 || order > 99) return fail("Order is a whole number, for example 1.");
  if (CLASSES.some((c) => c.grade.toLowerCase() === n.toLowerCase())) return fail(`${n} already exists. Add a section to it instead.`);
  const r = checkSection(n, section.trim(), capacity); if (!r.ok) return r;
  create(n, section.trim(), capacity, order, true);
  return ok;
}
/** Rename a section or change its capacity. Custom classes can also be renamed and re-ordered (all their sections). */
export function updateSection(id: string, section: string, capacity: number, custom?: { name: string; order: number }): Result {
  const row = CLASSES.find((c) => c.id === id); if (!row) return fail("This class no longer exists.");
  const newName = custom ? custom.name.trim().replace(/\s+/g, " ") : row.grade;
  if (custom) {
    if (!newName || /^\d+$/.test(newName) || /[-/]/.test(newName) || newName.length > 20) return fail("Use a short name such as Nursery.");
    if (!Number.isInteger(custom.order)) return fail("Order is a whole number, for example 1.");
    if (CLASSES.some((c) => c.grade.toLowerCase() === newName.toLowerCase() && c.grade !== row.grade)) return fail(`${newName} already exists.`);
  }
  const r = checkSection(newName, section.trim(), capacity, id); if (!r.ok) return r;
  if (capacity < activeStudentsIn(id).length) return fail(`${activeStudentsIn(id).length} students are in this class. Capacity cannot be lower.`);
  const before = className(id); const oldCap = state.capacity[id] ?? 40;
  const sec = section.trim().length === 1 ? section.trim().toUpperCase() : section.trim();
  if (custom && row.custom) CLASSES.forEach((c) => { if (c.grade === row.grade) { c.grade = newName; c.order = custom.order; } });
  row.section = sec; sortShared();
  const changes = [before !== className(id) && `${before} to ${className(id)}`, oldCap !== capacity && `capacity ${oldCap} to ${capacity}`].filter(Boolean).join(", ");
  set({ capacity: { ...state.capacity, [id]: capacity } });
  audit("class.updated", `Updated Class ${className(id)}${changes ? ` (${changes})` : ""}`, `Class ${className(id)}`, before !== className(id) ? [{ field: "Class name", from: before, to: className(id) }] : undefined);
  return ok;
}
/** Why a class cannot be deleted right now, or null. Students are never deleted with a section. */
export function deleteBlocker(id: string): string | null {
  const n = studentsEver(id), t = assignmentCount(id);
  if (n) return `${n} student${n > 1 ? "s are" : " is"} in this class. Move them to another class first. Removing a section never deletes students.`;
  if (t) return `${t} teacher assignment${t > 1 ? "s" : ""} point to this class. Set them to Not assigned in the Teachers tab first.`;
  return null;
}
export function deleteClass(id: string): Result {
  const blocked = deleteBlocker(id); if (blocked) return fail(blocked);
  const idx = CLASSES.findIndex((c) => c.id === id); if (idx < 0) return fail("This class no longer exists.");
  const label = className(id); CLASSES.splice(idx, 1);
  const { [id]: _a, ...subjectsRest } = state.classSubjects; void _a;
  const { [id]: _b, ...capRest } = state.capacity; void _b;
  const { [id]: _c, ...yearRest } = state.classYear; void _c;
  set({ capacity: capRest, classYear: yearRest, classSubjects: subjectsRest, exams: state.exams.map((e) => ({ ...e, classIds: e.classIds.filter((c) => c !== id), subjects: e.subjects.filter((s) => s.classId !== id) })) });
  audit("class.deleted", `Deleted Class ${label}`, `Class ${label}`);
  return ok;
}

/* ---------- Subjects ---------- */
function checkSubject(name: string, code: string, selfId?: string): Result {
  if (!name.trim()) return fail("Give the subject a name.");
  if (!/^[A-Za-z0-9]{2,5}$/.test(code.trim())) return fail("Code is 2 to 5 letters or digits, for example MAT.");
  if (state.subjects.some((s) => s.id !== selfId && s.name.toLowerCase() === name.trim().toLowerCase())) return fail(`${name.trim()} already exists.`);
  if (state.subjects.some((s) => s.id !== selfId && s.code.toLowerCase() === code.trim().toLowerCase())) return fail(`Code ${code.trim().toUpperCase()} is used by another subject.`);
  return ok;
}
/** Add a subject and, optionally, the classes that study it. */
export function addSubject(name: string, code: string, classIds: string[] = []): Result {
  const r = checkSubject(name, code); if (!r.ok) return r;
  const id = uid("sub");
  set({
    subjects: [...state.subjects, { id, name: name.trim(), code: code.trim().toUpperCase() }],
    classSubjects: { ...state.classSubjects, ...Object.fromEntries(classIds.map((c) => [c, [...new Set([...(state.classSubjects[c] ?? []), id])]])) },
  });
  audit("subject.created", `Added subject ${name.trim()}${classIds.length ? ` to ${classIds.length} classes` : ""}`, name.trim());
  return ok;
}
export function updateSubject(id: string, name: string, code: string): Result {
  const r = checkSubject(name, code, id); if (!r.ok) return r;
  const old = state.subjects.find((s) => s.id === id);
  set({ subjects: state.subjects.map((s) => (s.id === id ? { ...s, name: name.trim(), code: code.trim().toUpperCase() } : s)) });
  if (old && old.name !== name.trim()) { renameSubjectAssignments(old.name, name.trim()); audit("subject.renamed", `Renamed subject ${old.name} to ${name.trim()}`, name.trim(), [{ field: "Subject name", from: old.name, to: name.trim() }]); }
  return ok;
}
export function removeSubject(id: string): Result {
  const hasMarks = Object.keys(state.marks).some((k) => k.split("|")[1] === id);
  if (hasMarks) return fail("Marks are already entered for this subject, so it cannot be removed.");
  const gone = state.subjects.find((s) => s.id === id);
  if (gone) dropSubjectAssignments(gone.name);
  set({
    subjects: state.subjects.filter((s) => s.id !== id),
    classSubjects: Object.fromEntries(Object.entries(state.classSubjects).map(([c, l]) => [c, l.filter((x) => x !== id)])),
    exams: state.exams.map((e) => ({ ...e, subjects: e.subjects.filter((s) => s.subjectId !== id) })),
  });
  if (gone) audit("subject.removed", `Removed subject ${gone.name} from the school`, gone.name);
  return ok;
}
/** Tick or untick subjects for many classes at once. Unticking also ends the teacher assignments for it in those classes. */
export function setClassSubjects(classIds: string[], subjectIds: string[], on: boolean) {
  const next = { ...state.classSubjects };
  for (const c of classIds) { const cur = next[c] ?? []; next[c] = on ? [...new Set([...cur, ...subjectIds])] : cur.filter((x) => !subjectIds.includes(x)); }
  if (!on) for (const sid of subjectIds) { const n = state.subjects.find((x) => x.id === sid)?.name; if (n) dropSubjectAssignments(n, classIds); }
  set({ classSubjects: next });
  const names = subjectIds.map(subjectName).join(", ");
  audit("classsubjects.changed", `${on ? "Added" : "Removed"} ${names} ${on ? "to" : "from"} ${classIds.map(className).join(", ")}`, names);
}
export const setClassSubject = (classId: string, subjectId: string, on: boolean) => setClassSubjects([classId], [subjectId], on);
export const subjectName = (id: string) => state.subjects.find((s) => s.id === id)?.name ?? "Removed subject";

/* ---------- Grading ---------- */
/** Returns the first problem with a scheme, or null when it is valid. */
export function validateScheme(s: GradingScheme): string | null {
  if (!s.bands.length) return "Add at least one grade band.";
  for (const b of s.bands) {
    if (!b.grade.trim()) return "Every band needs a grade name.";
    if (!Number.isInteger(b.min) || b.min < 1 || b.min > 100) return `${b.grade || "A band"}: the minimum must be a whole number from 1 to 100.`;
  }
  for (let i = 1; i < s.bands.length; i++) {
    if (s.bands[i].min === s.bands[i - 1].min) return `${s.bands[i - 1].grade} and ${s.bands[i].grade} start at the same percent. Bands cannot overlap.`;
    if (s.bands[i].min > s.bands[i - 1].min) return `${s.bands[i].grade} starts above ${s.bands[i - 1].grade}. List bands from highest to lowest.`;
  }
  const names = s.bands.map((b) => b.grade.trim().toLowerCase()).concat(s.floorGrade.trim().toLowerCase());
  if (!s.floorGrade.trim()) return "Name the grade for marks below the lowest band.";
  if (new Set(names).size !== names.length) return "Each grade name can be used once.";
  if (!Number.isFinite(s.passPercent) || s.passPercent < 1 || s.passPercent > 100) return "Pass percent must be between 1 and 100.";
  return null;
}
export const saveScheme = (s: GradingScheme) => set({ scheme: { ...s, bands: s.bands.map((b) => ({ min: b.min, grade: b.grade.trim() })), floorGrade: s.floorGrade.trim() } });
/** Grade for a percent, using the school's current scheme. */
export function gradeFor(percent: number, scheme: GradingScheme = state.scheme): string {
  return scheme.bands.find((b) => percent >= b.min)?.grade ?? scheme.floorGrade;
}

/* ---------- Exams ---------- */
export const examsForClass = (classId: string) => state.exams.filter((e) => e.classIds.includes(classId));
export const examSubjectsFor = (examId: string, classId: string) => state.exams.find((e) => e.id === examId)?.subjects.filter((s) => s.classId === classId) ?? [];
export function validateExam(e: Omit<Exam, "id"> & { id?: string }): string | null {
  if (!e.name.trim()) return "Give the exam a name.";
  if (state.exams.some((x) => x.id !== e.id && x.name.toLowerCase() === e.name.trim().toLowerCase())) return `${e.name.trim()} already exists.`;
  if (!e.term.trim()) return "Choose a term.";
  if (!e.fromOn || !e.toOn || e.toOn < e.fromOn) return "The last date cannot be before the first date.";
  if (!e.classIds.length) return "Choose at least one class.";
  if (!e.subjects.length) return "Add marks for at least one subject.";
  for (const s of e.subjects) {
    if (!Number.isInteger(s.max) || s.max < 1) return `${subjectName(s.subjectId)}: maximum marks must be a whole number above 0.`;
    if (!Number.isInteger(s.pass) || s.pass < 0 || s.pass > s.max) return `${subjectName(s.subjectId)}: pass marks must be between 0 and ${s.max}.`;
  }
  return null;
}
export function saveExam(e: Omit<Exam, "id"> & { id?: string }): string {
  const id = e.id ?? uid("e");
  const clean: Exam = { ...e, id, name: e.name.trim(), subjects: e.subjects.filter((s) => e.classIds.includes(s.classId)) };
  set({ exams: state.exams.some((x) => x.id === id) ? state.exams.map((x) => (x.id === id ? clean : x)) : [...state.exams, clean] });
  return id;
}

/* ---------- Marks, remarks, publishing ---------- */
const SEED_REMARK = "Steady progress. Keep revising Mathematics.";
/** Unit Test 2 starts with demo marks (same formula the parent view always used). */
function seedMark(examId: string, subjectId: string, studentId: string): number | undefined {
  if (examId !== "e1") return undefined;
  const i = CORE.indexOf(subjectId); if (i < 0) return undefined;
  const n = Number(studentId.replace("st", ""));
  return 52 + ((n * 13 + i * 17) % 46);
}
export const markOf = (examId: string, subjectId: string, studentId: string): number | undefined =>
  state.marks[`${examId}|${subjectId}|${studentId}`] ?? seedMark(examId, subjectId, studentId);
export function saveMarks(entries: { examId: string; subjectId: string; studentId: string; marks: number | null }[]) {
  const next = { ...state.marks };
  for (const e of entries) { const k = `${e.examId}|${e.subjectId}|${e.studentId}`; if (e.marks === null) delete next[k]; else next[k] = e.marks; }
  set({ marks: next });
}
export const remarkOf = (examId: string, studentId: string) => state.remarks[`${examId}|${studentId}`] ?? (examId === "e1" ? SEED_REMARK : "");
export const setRemark = (examId: string, studentId: string, text: string) => set({ remarks: { ...state.remarks, [`${examId}|${studentId}`]: text } });
export const publicationOf = (examId: string, classId: string) => state.published[`${examId}|${classId}`];
export function setPublished(examId: string, classId: string, on: boolean, at: string) {
  const { [`${examId}|${classId}`]: _drop, ...rest } = state.published; void _drop;
  set({ published: on ? { ...rest, [`${examId}|${classId}`]: { at } } : rest });
}
