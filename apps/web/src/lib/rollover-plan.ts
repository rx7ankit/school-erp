/**
 * Year-end rollover: everything derived from the draft. Pure functions, nothing here changes the school.
 * The wizard (live summary, review) and applyRollover() both read the same plan, so the numbers always match.
 */
import { getAcademic, isStandardGrade, subjectName } from "./academic-setup";
import { classTeacherOf, subjectTeacherOf } from "./assignments";
import { HEADS, CONCESSIONS, STRUCTURE, balanceOf, isClosed } from "./fees-setup";
import { ADMISSIONS, ARCHIVED_CLASSES, CLASSES, INVOICES, STUDENTS, findClass, type ClassRow, type Student } from "./mock";
import type { Decision, Dest, Fate, PlanClass, RolloverDraft, RolloverPreview } from "./rollover-types";

export const keyOf = (grade: string, section: string) => `${grade}|${section}`;
export const parseKey = (key: string) => { const [grade, section] = key.split("|"); return { grade, section }; };
export const keyLabel = (key: string) => { const { grade, section } = parseKey(key); return `${grade}-${section}`; };
export const yearName = (label: string) => label.replace("–", "-");

/** Students who are in school now (already-left students are never listed). */
export const activeStudents = (): Student[] => STUDENTS.filter((s) => s.status === "active" && !!CLASSES.find((c) => c.id === s.classId));
export const decisionOf = (d: RolloverDraft, studentId: string): Decision => d.decisions[studentId] ?? "promote";

/* ---------- Where each class goes ---------- */
/** The last grade of the school: grade 12, or the highest standard grade the school runs when that is 10 or above. */
export function isFinalGrade(grade: string): boolean {
  if (!isStandardGrade(grade)) return false;
  if (grade === "12") return true;
  const top = Math.max(...CLASSES.filter((c) => !c.custom && isStandardGrade(c.grade)).map((c) => Number(c.grade)), 0);
  return Number(grade) >= 10 && Number(grade) >= top;
}
/** Same section of the next grade; a custom class follows its "next class"; null when the class completes school. */
export function defaultDest(c: ClassRow): Dest {
  if (c.custom) {
    const next = c.nextClassId ? findClass(c.nextClassId) : undefined;
    if (next) return { grade: next.grade, section: c.section };
    const later = CLASSES.filter((x) => x.order > c.order).sort((a, b) => a.order - b.order)[0];
    return later ? { grade: later.grade, section: c.section } : null;
  }
  if (isFinalGrade(c.grade)) return null;
  return { grade: String(Number(c.grade) + 1), section: c.section };
}
export const destOf = (d: RolloverDraft, c: ClassRow): Dest => (c.id in d.dest ? d.dest[c.id] : defaultDest(c));

/** What happens to one student. */
export function fateOf(d: RolloverDraft, s: Student): Fate {
  const c = CLASSES.find((x) => x.id === s.classId);
  const decision = decisionOf(d, s.id);
  if (!c) return { kind: "left" };
  if (decision === "leave") return { kind: "left" };
  if (decision === "stay") return { kind: "class", key: keyOf(c.grade, c.section), how: "stayed" };
  const dest = destOf(d, c);
  return dest ? { kind: "class", key: keyOf(dest.grade, dest.section), how: "promoted" } : { kind: "passed_out" };
}

/* ---------- The classes of the new year ---------- */
function orderOfGrade(grade: string): number {
  if (isStandardGrade(grade)) return Number(grade);
  const known = CLASSES.find((c) => c.grade === grade) ?? ARCHIVED_CLASSES.find((c) => c.grade === grade);
  return known?.order ?? 50;
}
const sameSection = (grade: string, section: string) => CLASSES.find((c) => c.grade === grade && c.section.toLowerCase() === section.toLowerCase());
const sameGrade = (grade: string, section: string) => sameSection(grade, section) ?? CLASSES.find((c) => c.grade === grade);

export interface RolloverPlan { classes: PlanClass[]; byKey: Map<string, PlanClass>; fates: Map<string, Fate>; }

export function buildPlan(d: RolloverDraft): RolloverPlan {
  const fates = new Map<string, Fate>();
  const counts = new Map<string, { promoted: number; stayed: number }>();
  const feeders = new Map<string, Map<string, number>>(); // new key -> old class id -> promoted students
  for (const s of activeStudents()) {
    const f = fateOf(d, s); fates.set(s.id, f);
    if (f.kind !== "class") continue;
    const cur = counts.get(f.key) ?? { promoted: 0, stayed: 0 };
    cur[f.how === "promoted" ? "promoted" : "stayed"] += 1; counts.set(f.key, cur);
    if (f.how === "promoted") { const m = feeders.get(f.key) ?? new Map<string, number>(); m.set(s.classId, (m.get(s.classId) ?? 0) + 1); feeders.set(f.key, m); }
  }
  const keys = new Set(counts.keys());
  const fresh = new Set<string>();
  const grades = new Set([...keys].map((k) => parseKey(k).grade));
  // Nobody moves into this grade (the entry class): keep an empty section for new admissions.
  for (const c of CLASSES) { const k = keyOf(c.grade, c.section); if (!grades.has(c.grade) && !keys.has(k)) { fresh.add(k); } }
  for (const k of fresh) keys.add(k);
  for (const k of d.extraClasses) keys.add(k);
  for (const k of d.removedClasses) if (!(counts.get(k)?.promoted || counts.get(k)?.stayed)) keys.delete(k);

  const acad = getAcademic();
  const classes: PlanClass[] = [...keys].map((key) => {
    const { grade, section } = parseKey(key);
    const n = counts.get(key) ?? { promoted: 0, stayed: 0 };
    const near = sameGrade(grade, section);
    const custom = !isStandardGrade(grade);
    const cap = d.capacity[key] ?? (near ? acad.capacity[near.id] ?? 40 : 40);
    const up = [...(feeders.get(key) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return { key, grade, section, order: orderOfGrade(grade), custom, capacity: cap, promoted: n.promoted, stayed: n.stayed, total: n.promoted + n.stayed, fresh: fresh.has(key), extra: d.extraClasses.includes(key), sameSource: sameSection(grade, section)?.id, upSource: up };
  }).sort((a, b) => a.order - b.order || a.grade.localeCompare(b.grade) || a.section.localeCompare(b.section));
  return { classes, byKey: new Map(classes.map((c) => [c.key, c])), fates };
}

/* ---------- Subjects and teachers ---------- */
const CORE_NAMES = ["Mathematics", "English", "Hindi", "Science", "Social Science"];
/** Subject names of a class: what you ticked, else what the same grade studied this year. */
export function subjectsOf(d: RolloverDraft, key: string): string[] {
  if (d.classSubjects[key]) return d.classSubjects[key];
  const { grade, section } = parseKey(key);
  const near = sameGrade(grade, section);
  if (near) return (getAcademic().classSubjects[near.id] ?? []).map(subjectName);
  return isStandardGrade(grade) ? CORE_NAMES : [];
}
/** Every subject the school will have: existing ones plus the ones added in this wizard. */
export const allSubjectNames = (d: RolloverDraft): string[] => [...getAcademic().subjects.map((s) => s.name), ...d.newSubjects.map((s) => s.name)];
export function setSubjectOn(d: RolloverDraft, keys: string[], name: string, on: boolean): RolloverDraft {
  const next = { ...d.classSubjects };
  for (const k of keys) { const cur = subjectsOf(d, k); next[k] = on ? [...new Set([...cur, name])] : cur.filter((x) => x !== name); }
  return { ...d, classSubjects: next };
}

export interface TeacherChoice { ct: string | null; subjects: Record<string, string | null>; }
/** Last year's class whose teachers the starting point copies. */
export function teacherSource(d: RolloverDraft, c: PlanClass): string | undefined {
  return d.teacherMode === "same" ? c.sameSource : d.teacherMode === "move_up" ? c.upSource : undefined;
}
export function teacherChoice(d: RolloverDraft, c: PlanClass): TeacherChoice {
  const src = teacherSource(d, c);
  const over = d.teachers[c.key];
  const names = subjectsOf(d, c.key);
  return {
    ct: over && "ct" in over ? over.ct ?? null : src ? classTeacherOf(src)?.id ?? null : null,
    subjects: Object.fromEntries(names.map((n) => [n, over?.subjects && n in over.subjects ? over.subjects[n] ?? null : src ? subjectTeacherOf(src, n)?.id ?? null : null])),
  };
}
export function slotCounts(d: RolloverDraft, plan: RolloverPlan): { filled: number; total: number } {
  let filled = 0, total = 0;
  for (const c of plan.classes) {
    const t = teacherChoice(d, c); const names = Object.keys(t.subjects);
    total += 1 + names.length; filled += (t.ct ? 1 : 0) + names.filter((n) => t.subjects[n]).length;
  }
  return { filled, total };
}

/* ---------- Fees ---------- */
export const activeHeads = (d: RolloverDraft) => [...HEADS.filter((h) => !d.fees.removedHeads.includes(h.id)), ...d.fees.newHeads];
/** Amount (paise) for a class and head: what you typed, else this year's amount for the same grade. */
export function feeAmount(d: RolloverDraft, key: string, headId: string): number {
  const typed = d.fees.grid[key]?.[headId];
  if (typed !== undefined) return typed;
  const { grade, section } = parseKey(key);
  let near = sameGrade(grade, section);
  if (!near && isStandardGrade(grade)) near = CLASSES.filter((c) => isStandardGrade(c.grade) && Number(c.grade) < Number(grade)).sort((a, b) => Number(b.grade) - Number(a.grade))[0];
  return near ? STRUCTURE[near.id]?.[headId] ?? 0 : 0;
}
export const classFeeTotal = (d: RolloverDraft, key: string) => activeHeads(d).reduce((a, h) => a + feeAmount(d, key, h.id), 0);
export const carryDefault = (name: string) => /rte|staff|sibling/i.test(name);
export const carryOn = (d: RolloverDraft, id: string) => d.fees.carry[id] ?? carryDefault(CONCESSIONS.find((c) => c.id === id)?.name ?? "");

/** Students with money still owed on last year's invoices. */
export function openDues(): { students: Student[]; paise: number; by: Map<string, number> } {
  const by = new Map<string, number>();
  for (const i of INVOICES) { if (isClosed(i)) continue; const owed = balanceOf(i); if (owed > 0) by.set(i.studentId, (by.get(i.studentId) ?? 0) + owed); }
  const students = STUDENTS.filter((s) => s.status === "active" && by.has(s.id));
  return { students, paise: students.reduce((a, s) => a + (by.get(s.id) ?? 0), 0), by };
}
export const approvedAdmissions = () => ADMISSIONS.filter((a) => a.status === "approved").length;

/* ---------- Review numbers ---------- */
export function previewRollover(d: RolloverDraft): RolloverPreview {
  const plan = buildPlan(d);
  const fates = [...plan.fates.values()];
  const promoted = fates.filter((f) => f.kind === "class" && f.how === "promoted").length;
  const stayed = fates.filter((f) => f.kind === "class" && f.how === "stayed").length;
  const leaving = fates.filter((f) => f.kind === "left").length;
  const passedOut = fates.filter((f) => f.kind === "passed_out").length;
  const slots = slotCounts(d, plan);
  const dues = openDues();
  const notified = activeStudents().filter((s) => plan.fates.get(s.id)?.kind !== "left");
  const feeByClass = plan.classes.map((c) => ({ key: c.key, label: keyLabel(c.key), students: c.total, perStudentPaise: classFeeTotal(d, c.key) }));
  const warnings: string[] = [];
  const duesMoving = dues.students.filter((s) => plan.fates.get(s.id)?.kind === "class");
  const duesMovingPaise = duesMoving.reduce((a, s) => a + (dues.by.get(s.id) ?? 0), 0);
  if (d.fees.dues === "carry" && duesMoving.length) warnings.push(`${duesMoving.length} ${duesMoving.length === 1 ? "student with unpaid fees" : "students with unpaid fees"} will move on. Their dues follow them.`);
  for (const c of plan.classes) if (c.total > c.capacity) warnings.push(`Class ${keyLabel(c.key)} has ${c.total} students for ${c.capacity} seats.`);
  const noCt = plan.classes.filter((c) => c.total > 0 && !teacherChoice(d, c).ct);
  if (noCt.length) warnings.push(`${noCt.length} ${noCt.length === 1 ? "class has" : "classes have"} no class teacher yet (${noCt.map((c) => keyLabel(c.key)).join(", ")}). You can assign them after.`);
  return {
    promoted, stayed, leaving, passedOut, total: fates.length,
    newClasses: plan.classes.length, freshClasses: plan.classes.filter((c) => c.fresh).length,
    subjectTicks: plan.classes.reduce((a, c) => a + subjectsOf(d, c.key).length, 0), newSubjects: d.newSubjects.length,
    slotsFilled: slots.filled, slotsTotal: slots.total,
    feeByClass, feesTotalPaise: feeByClass.reduce((a, c) => a + c.students * c.perStudentPaise, 0),
    duesStudents: dues.students.length, duesPaise: dues.paise,
    duesMovingPaise, duesMovingStudents: duesMoving.length, duesStayingPaise: dues.paise - duesMovingPaise,
    invoicesNow: d.fees.invoices === "now", invoiceStudents: promoted + stayed,
    parentsNotified: new Set(notified.map((s) => s.guardianEmail)).size, studentsNotified: notified.length,
    warnings,
  };
}
