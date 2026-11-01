"use client";
/**
 * Academic setup demo store (module level, resets on a full reload).
 * Shapes follow docs/erd.md "Academic setup": academic_years, classes, subjects, class_subjects,
 * grading_schemes + grade_bands, exams + exam_subjects, plus marks, remarks and publishing state.
 */
import * as React from "react";
import { CLASSES, STUDENTS } from "./mock";

export interface AcademicYear { id: string; label: string; fromOn: string; toOn: string; current: boolean; }
export interface ClassRow { id: string; grade: string; section: string; capacity: number; }
export interface Subject { id: string; name: string; code: string; }
export interface GradeBand { min: number; grade: string; }
export interface GradingScheme { bands: GradeBand[]; floorGrade: string; passPercent: number; }
export interface ExamSubject { classId: string; subjectId: string; max: number; pass: number; }
export interface Exam { id: string; name: string; term: string; fromOn: string; toOn: string; classIds: string[]; subjects: ExamSubject[]; }
export interface Publication { at: string; }

interface State {
  years: AcademicYear[];
  classes: ClassRow[];
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

const initial = (): State => ({
  years: [
    { id: "y2026", label: "2026-27", fromOn: "2026-04-01", toOn: "2027-03-31", current: true },
    { id: "y2027", label: "2027-28", fromOn: "2027-04-01", toOn: "2028-03-31", current: false },
  ],
  classes: CLASSES.map((c) => ({ id: c.id, grade: c.grade, section: c.section, capacity: 40 })),
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

let state: State = initial();
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
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
  return ok;
}
export const setCurrentYear = (id: string) => set({ years: state.years.map((y) => ({ ...y, current: y.id === id })) });
export const currentYear = () => state.years.find((y) => y.current) ?? state.years[0];

/* ---------- Classes and sections ---------- */
export const classLabel = (id: string) => { const c = state.classes.find((x) => x.id === id); return c ? `${c.grade}-${c.section}` : "—"; };
export const activeStudentsIn = (classId: string) => STUDENTS.filter((s) => s.classId === classId && s.status === "active");
const sortClasses = (l: ClassRow[]) => [...l].sort((a, b) => Number(a.grade) - Number(b.grade) || a.section.localeCompare(b.section));
function checkClass(grade: string, section: string, capacity: number, selfId?: string): Result {
  if (!/^(1[0-2]|[1-9])$/.test(grade)) return fail("Class must be a number from 1 to 12.");
  if (!/^[A-Za-z]$/.test(section)) return fail("Section is one letter, for example A.");
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) return fail("Capacity must be between 1 and 100.");
  if (state.classes.some((c) => c.id !== selfId && c.grade === grade && c.section === section.toUpperCase())) return fail(`Class ${grade}-${section.toUpperCase()} already exists.`);
  return ok;
}
export function addClass(grade: string, section: string, capacity: number): Result {
  const r = checkClass(grade, section, capacity); if (!r.ok) return r;
  const id = uid("c"); const sec = section.toUpperCase();
  set({ classes: sortClasses([...state.classes, { id, grade, section: sec, capacity }]), classSubjects: { ...state.classSubjects, [id]: [...CORE].filter((s) => state.subjects.some((x) => x.id === s)) } });
  return ok;
}
export function updateClass(id: string, grade: string, section: string, capacity: number): Result {
  const r = checkClass(grade, section, capacity, id); if (!r.ok) return r;
  if (capacity < activeStudentsIn(id).length) return fail(`${activeStudentsIn(id).length} students are in this class. Capacity cannot be lower.`);
  set({ classes: sortClasses(state.classes.map((c) => (c.id === id ? { ...c, grade, section: section.toUpperCase(), capacity } : c))) });
  return ok;
}
export function deleteClass(id: string): Result {
  const n = activeStudentsIn(id).length;
  if (n) return fail(`${n} students are in this class. Move them first.`);
  const { [id]: _drop, ...rest } = state.classSubjects; void _drop;
  set({ classes: state.classes.filter((c) => c.id !== id), classSubjects: rest, exams: state.exams.map((e) => ({ ...e, classIds: e.classIds.filter((c) => c !== id), subjects: e.subjects.filter((s) => s.classId !== id) })) });
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
export function addSubject(name: string, code: string): Result {
  const r = checkSubject(name, code); if (!r.ok) return r;
  set({ subjects: [...state.subjects, { id: uid("sub"), name: name.trim(), code: code.trim().toUpperCase() }] });
  return ok;
}
export function updateSubject(id: string, name: string, code: string): Result {
  const r = checkSubject(name, code, id); if (!r.ok) return r;
  set({ subjects: state.subjects.map((s) => (s.id === id ? { ...s, name: name.trim(), code: code.trim().toUpperCase() } : s)) });
  return ok;
}
export function removeSubject(id: string): Result {
  const hasMarks = Object.keys(state.marks).some((k) => k.split("|")[1] === id);
  if (hasMarks) return fail("Marks are already entered for this subject, so it cannot be removed.");
  set({
    subjects: state.subjects.filter((s) => s.id !== id),
    classSubjects: Object.fromEntries(Object.entries(state.classSubjects).map(([c, l]) => [c, l.filter((x) => x !== id)])),
    exams: state.exams.map((e) => ({ ...e, subjects: e.subjects.filter((s) => s.subjectId !== id) })),
  });
  return ok;
}
export function setClassSubject(classId: string, subjectId: string, on: boolean) {
  const cur = state.classSubjects[classId] ?? [];
  set({ classSubjects: { ...state.classSubjects, [classId]: on ? [...new Set([...cur, subjectId])] : cur.filter((x) => x !== subjectId) } });
}
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
