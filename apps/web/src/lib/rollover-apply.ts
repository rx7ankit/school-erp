"use client";
/**
 * Year-end rollover: Apply. Every effect happens here, in order, in one go (docs/year-rollover.md "What Apply does").
 * Everything that can be worked out is worked out first, so a bad draft is refused before anything changes.
 */
import { commitRollover, currentYear, restoreAcademic, snapshotAcademic } from "./academic-setup";
import { touchAssignments } from "./assignments";
import { logAudit } from "./audit";
import { ASSIGNMENTS, CONCESSIONS, HEADS, addHead, generateInvoices, removeHead, saveStructure, touchFees, unassignConcession, balanceOf, isClosed } from "./fees-setup";
import { ARCHIVED_CLASSES, CLASSES, INVOICES, SCHOOL, STAFF, STUDENTS, className, findClass, settle, type ClassRow, type Student } from "./mock";
import { notify } from "./notifications";
import { activeHeads, activeStudents, buildPlan, carryOn, feeAmount, keyLabel, openDues, slotCounts, subjectsOf, teacherChoice, yearName, type RolloverPlan } from "./rollover-plan";
import { clearDraft } from "./rollover-draft";
import { setLastResult } from "./rollover-checklist";
import type { ChecklistItem, PromotionRow, RolloverDraft, RolloverResult } from "./rollover-types";
import { recordRollover } from "./student-record";
import { allSlotsNow, replaceSlots, type Slot } from "./timetable";
import { formatINR, nowUTC, todayOnIST } from "./time";

/** The first problem that stops the rollover, or null. Shown on the review step. */
export function validateDraft(d: RolloverDraft): string | null {
  if (!/^\d{4}-\d{2}$/.test(d.year.label)) return "Write the new year as 2027-28.";
  if (d.year.label === d.fromLabel) return "The new year must be different from the current year.";
  if (!d.year.fromOn || !d.year.toOn || d.year.toOn <= d.year.fromOn) return "The new year must end after it starts.";
  const plan = buildPlan(d);
  if (!plan.classes.length && activeStudents().length) return "There are no classes in the new year.";
  for (const c of plan.classes) {
    if (!/^[A-Za-z0-9]{1,8}$/.test(c.section)) return `Class ${c.grade}-${c.section || "?"}: use a short section name such as A.`;
    if (!Number.isInteger(c.capacity) || c.capacity < 1 || c.capacity > 100) return `Class ${keyLabel(c.key)}: seats must be between 1 and 100.`;
  }
  const names = [...d.newSubjects.map((s) => s.name.toLowerCase())];
  if (new Set(names).size !== names.length) return "A new subject is listed twice.";
  for (const [k, row] of Object.entries(d.fees.grid)) for (const v of Object.values(row)) if (!Number.isFinite(v) || v < 0) return `Class ${keyLabel(k)}: fee amounts cannot be negative.`;
  if (d.fees.dues === "writeoff" && d.fees.writeoffReason.trim().length < 5) return "Write a reason of at least 5 characters for writing off dues.";
  if (d.fees.invoices === "now" && (!d.fees.period.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(d.fees.dueOn))) return "Choose the period and due date for the first invoices.";
  if (!d.ack) return "Tick the box to confirm you have checked this.";
  return null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
function newIds(plan: RolloverPlan, label: string): Map<string, string> {
  const taken = new Set([...CLASSES, ...ARCHIVED_CLASSES].map((c) => c.id));
  const out = new Map<string, string>();
  for (const c of plan.classes) {
    const base = `c${slug(c.grade)}${slug(c.section)}-${label.slice(2, 4)}${label.slice(5)}`; let id = base, n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    taken.add(id); out.set(c.key, id);
  }
  return out;
}

export function applyRollover(d: RolloverDraft, by: string): RolloverResult {
  const problem = validateDraft(d);
  if (problem) throw new Error(problem);
  const plan = buildPlan(d);
  const label = d.year.label;
  const ids = newIds(plan, label);
  const oldClasses: ClassRow[] = [...CLASSES];
  const oldIds = new Set(oldClasses.map((c) => c.id));
  const today = todayOnIST();
  const oldEnd = currentYear().toOn; // students who leave are marked left on the last day of the old year

  /* ----- work everything out first (nothing changes yet) ----- */
  const students = activeStudents();
  const members = new Map<string, Student[]>();
  for (const s of students) { const f = plan.fates.get(s.id); if (f?.kind === "class") members.set(f.key, [...(members.get(f.key) ?? []), s]); }
  const oldOrder = (s: Student) => { const c = oldClasses.find((x) => x.id === s.classId)!; return `${String(c.order).padStart(3, "0")}${c.section}${String(s.rollNo).padStart(4, "0")}`; };
  const rolls = new Map<string, number>();
  for (const list of members.values()) {
    [...list].sort((a, b) => (d.keepOrder ? oldOrder(a).localeCompare(oldOrder(b)) : a.name.localeCompare(b.name))).forEach((s, i) => rolls.set(s.id, i + 1));
  }
  const choices = new Map(plan.classes.map((c) => [c.key, teacherChoice(d, c)]));
  const subjectNames = new Map(plan.classes.map((c) => [c.key, subjectsOf(d, c.key)]));
  const slots = slotCounts(d, plan);
  const amounts = new Map(plan.classes.map((c) => [c.key, new Map(activeHeads(d).map((h) => [h.id, feeAmount(d, c.key, h.id)]))]));
  const dues = openDues();
  const dueIds = new Set(dues.students.map((s) => s.id));
  const fateOfStudent = (s: Student) => plan.fates.get(s.id)!;
  const duesContinuing = dues.students.filter((s) => fateOfStudent(s).kind === "class");
  const owedBy = new Map<string, number>();
  for (const i of INVOICES) if (!isClosed(i) && balanceOf(i) > 0) owedBy.set(i.studentId, (owedBy.get(i.studentId) ?? 0) + balanceOf(i));
  const sourceOf = (c: { sameSource?: string; upSource?: string }) => (d.teacherMode === "move_up" ? c.upSource : c.sameSource);
  const oldSlots = allSlotsNow();
  const origClass = new Map(students.map((s) => [s.id, s.classId]));

  const rows: PromotionRow[] = [];
  const snap = {
    classes: [...CLASSES], archived: [...ARCHIVED_CLASSES], year: SCHOOL.year, academic: snapshotAcademic(),
    students: STUDENTS.map((s) => ({ s, classId: s.classId, rollNo: s.rollNo, status: s.status, leftOn: s.leftOn, leavingReason: s.leavingReason })),
    staff: STAFF.map((t) => ({ t, classes: t.classes })),
  };
  try {
    /* (a) + (b) year and classes */
    const newRows: { row: ClassRow; capacity: number; subjectNames: string[] }[] = plan.classes.map((c) => ({
      row: { id: ids.get(c.key)!, grade: c.grade, section: c.section, order: c.order, ...(c.custom ? { custom: true as const } : {}) },
      capacity: c.capacity, subjectNames: subjectNames.get(c.key)!,
    }));
    // Custom class chain (Nursery, LKG...): point each new class at the new class its old chain led to.
    for (const nc of newRows) {
      if (!nc.row.custom) continue;
      const next = oldClasses.find((x) => x.grade === nc.row.grade && x.nextClassId);
      const target = next?.nextClassId ? findClass(next.nextClassId) : undefined;
      const hit = target ? newRows.find((x) => x.row.grade === target.grade && x.row.section === nc.row.section) ?? newRows.find((x) => x.row.grade === target.grade) : undefined;
      if (hit) nc.row.nextClassId = hit.row.id;
    }
    commitRollover({ newYear: d.year, classes: newRows, newSubjects: d.newSubjects });

    /* (c) students */
    for (const s of students) {
      const f = fateOfStudent(s);
      const from = className(s.classId);
      const grade = oldClasses.find((c) => c.id === s.classId)?.grade ?? from;
      const to = f.kind === "class" ? keyLabel(f.key) : "";
      if (f.kind === "class") {
        s.classId = ids.get(f.key)!; s.rollNo = rolls.get(s.id) ?? s.rollNo;
        const promoted = f.how === "promoted";
        recordRollover(s.id, promoted
          ? { title: `Promoted to ${to}`, detail: `Promoted from ${from} to ${to}, ${label} · ${by}`, on: today, tone: "brand" }
          : { title: `Stayed in ${to}`, detail: `Stayed in ${from} for ${label} · ${by}`, on: today, tone: "neutral" });
        rows.push({ scholarNo: s.scholarNo, name: s.name, from, outcome: promoted ? "Promoted" : "Stayed in class", to, roll: s.rollNo, guardian: s.guardian, phone: s.phone });
      } else if (f.kind === "passed_out") {
        const detail = `Completed Class ${grade}`;
        Object.assign(s, { status: "passed_out", leftOn: oldEnd, leavingReason: detail });
        recordRollover(s.id, { title: detail, detail: `${detail}, ${d.fromLabel} · ${by}`, on: today, tone: "brand" }, { status: "passed_out", leftOn: s.leftOn, leavingReason: detail });
        rows.push({ scholarNo: s.scholarNo, name: s.name, from, outcome: "Passed out", to: "Completed school", roll: null, guardian: s.guardian, phone: s.phone });
      } else {
        const leftOn = oldEnd;
        Object.assign(s, { status: "left", leftOn, leavingReason: "Left at the end of the year" });
        recordRollover(s.id, { title: "Left school", detail: `Left at the end of ${d.fromLabel} · ${by}`, on: leftOn, tone: "danger" }, { status: "left", leftOn, leavingReason: "Left at the end of the year" });
        rows.push({ scholarNo: s.scholarNo, name: s.name, from, outcome: "Leaving school", to: "", roll: null, guardian: s.guardian, phone: s.phone });
      }
    }

    /* (d) subjects are set in commitRollover; teachers and timetable */
    for (const t of STAFF) t.classes = t.classes.filter((e) => !oldIds.has(e.classId));
    for (const c of plan.classes) {
      const id = ids.get(c.key)!; const ch = choices.get(c.key)!;
      const ct = ch.ct ? STAFF.find((t) => t.id === ch.ct) : undefined;
      if (ct) ct.classes = [...ct.classes, { classId: id, role: "class_teacher" }];
      for (const [subject, staffId] of Object.entries(ch.subjects)) {
        const t = staffId ? STAFF.find((x) => x.id === staffId) : undefined; if (!t) continue;
        const i = t.classes.findIndex((e) => e.classId === id && !e.subject);
        t.classes = i >= 0 ? t.classes.map((e, k) => (k === i ? { ...e, subject } : e)) : [...t.classes, { classId: id, role: "subject_teacher", subject }];
      }
    }
    touchAssignments();
    let timetableSlots = 0;
    if (d.timetable === "copy") {
      const copied: Slot[] = [];
      for (const c of plan.classes) {
        const src = sourceOf(c) ?? c.sameSource; if (!src) continue;
        const ch = choices.get(c.key)!;
        for (const sl of oldSlots.filter((x) => x.classId === src)) {
          const staffId = ch.subjects[sl.subject]; if (!staffId) continue;
          copied.push({ ...sl, classId: ids.get(c.key)!, staffId });
        }
      }
      timetableSlots = copied.length; replaceSlots(copied);
    } else replaceSlots([]);

    /* (e) fees */
    for (const h of d.fees.removedHeads) removeHead(h);
    const headIdOf = new Map<string, string>();
    for (const h of d.fees.newHeads) { addHead(h.name, h.frequency); const made = HEADS.find((x) => x.name.toLowerCase() === h.name.trim().toLowerCase()); if (made) headIdOf.set(h.id, made.id); }
    saveStructure(Object.fromEntries(plan.classes.map((c) => [ids.get(c.key)!, Object.fromEntries([...amounts.get(c.key)!.entries()].map(([hid, v]) => [headIdOf.get(hid) ?? hid, v]))])));
    let concessionsEnded = 0;
    for (const c of CONCESSIONS) if (!carryOn(d, c.id)) for (const a of ASSIGNMENTS.filter((x) => x.concessionId === c.id)) { unassignConcession(a.id); concessionsEnded++; }

    let writtenOff = 0;
    if (d.fees.dues === "writeoff") {
      for (const i of INVOICES) {
        const owed = isClosed(i) ? 0 : balanceOf(i);
        if (owed > 0 && dueIds.has(i.studentId)) { i.items.push({ id: `wo-${i.id}`, label: `Written off at year end (${d.fees.writeoffReason.trim()})`, amountPaise: -owed, kind: "discount" }); settle(i); writtenOff += owed; }
      }
      touchFees();
      logAudit({ category: "fees", action: "dues.written_off", summary: `Wrote off ${formatINR(writtenOff)} of unpaid fees for ${dues.students.length} students at year end. Reason: ${d.fees.writeoffReason.trim()}`, entity: `Year end ${d.fromLabel}`, href: "/fees/setup", sensitive: true, changes: [{ field: "Unpaid fees", from: formatINR(writtenOff), to: formatINR(0) }] });
    }
    let invoicesCreated = 0;
    if (d.fees.invoices === "now") {
      const run = generateInvoices({ period: d.fees.period, dueOn: d.fees.dueOn, headIds: HEADS.filter((h) => h.frequency !== "once" && !/transport/i.test(h.name)).map((h) => h.id), classIds: [...ids.values()], by });
      invoicesCreated = run.created;
    }

    /* (f) parents */
    const sent = students.filter((s) => fateOfStudent(s).kind !== "left").map((s) => {
      const f = fateOfStudent(s);
      if (f.kind === "class") return { type: f.how === "promoted" ? ("promotion_promoted" as const) : ("promotion_stayed" as const), studentId: s.id, params: { classLabel: keyLabel(f.key), year: yearName(label) } };
      const grade = oldClasses.find((c) => c.id === origClass.get(s.id))?.grade ?? "";
      return { type: "promotion_completed" as const, studentId: s.id, params: { classLabel: grade, year: yearName(label) } };
    });
    notify(sent);

    /* (g) one audit summary */
    const counts = { promoted: rows.filter((r) => r.outcome === "Promoted").length, stayed: rows.filter((r) => r.outcome === "Stayed in class").length, passedOut: rows.filter((r) => r.outcome === "Passed out").length, leaving: rows.filter((r) => r.outcome === "Leaving school").length };
    const summary = `Applied year-end rollover ${d.fromLabel} to ${label}: ${counts.promoted} promoted, ${counts.stayed} stayed, ${counts.passedOut} passed out, ${counts.leaving} leaving; ${plan.classes.length} new classes; ${slots.filled} of ${slots.total} teacher slots filled; fees set for ${plan.classes.length} classes; ${d.fees.dues === "writeoff" ? `${formatINR(writtenOff)} written off` : `${formatINR(dues.paise)} dues carried forward`}; ${invoicesCreated} first invoices${concessionsEnded ? `; ${concessionsEnded} concessions not carried over` : ""}; ${sent.length} parents notified`;
    logAudit({ category: "academic", action: "rollover.applied", summary, entity: `${d.fromLabel} to ${label}`, href: "/classes", sensitive: true, changes: [{ field: "Academic year", from: d.fromLabel, to: label }, { field: "Current year", from: "Completed", to: "Current" }] });

    clearDraft();
    const result: RolloverResult = {
      appliedAt: nowUTC(), appliedBy: by, fromLabel: d.fromLabel, toLabel: label, ...counts,
      newClasses: plan.classes.length, subjects: [...subjectNames.values()].reduce((a, l) => a + l.length, 0),
      slotsFilled: slots.filled, slotsTotal: slots.total,
      duesCarriedPaise: d.fees.dues === "carry" ? duesContinuing.reduce((a, s) => a + (owedBy.get(s.id) ?? 0), 0) : 0, duesWrittenOffPaise: writtenOff,
      invoicesCreated, invoicePeriod: d.fees.invoices === "now" ? d.fees.period : null, timetableSlots, notified: new Set(sent.map((n) => students.find((s) => s.id === n.studentId)?.guardianEmail ?? n.studentId)).size,
      leavingIds: students.filter((s) => fateOfStudent(s).kind === "left").map((s) => s.id),
      rows: rows.sort((a, b) => a.from.localeCompare(b.from, undefined, { numeric: true }) || a.name.localeCompare(b.name)),
      checklist: [],
    };
    result.checklist = buildChecklist(result);
    setLastResult(result);
    return result;
  } catch (e) {
    CLASSES.splice(0, CLASSES.length, ...snap.classes); ARCHIVED_CLASSES.splice(0, ARCHIVED_CLASSES.length, ...snap.archived); SCHOOL.year = snap.year;
    for (const x of snap.students) Object.assign(x.s, { classId: x.classId, rollNo: x.rollNo, status: x.status, leftOn: x.leftOn, leavingReason: x.leavingReason });
    for (const x of snap.staff) x.t.classes = x.classes;
    restoreAcademic(snap.academic); touchAssignments();
    throw e;
  }
}

function buildChecklist(r: RolloverResult): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: "teachers", title: "Assign teachers to empty slots", detail: "", href: "/academic", linkLabel: "Open teachers", manual: false },
    { id: "timetable", title: "Set or check the timetable", detail: r.timetableSlots ? `${r.timetableSlots} periods were copied from last year.` : "It starts empty.", href: "/timetable", linkLabel: "Open timetable", manual: true },
    { id: "invoices", title: r.invoicePeriod ? `${r.invoicePeriod} invoices` : "Generate Term 1 invoices and send fee reminders", detail: "", href: r.invoicePeriod ? "/fees/setup" : "/fees/setup", linkLabel: r.invoicePeriod ? "Open fees" : "Generate invoices", manual: false },
    { id: "datesheet", title: "Publish the exam date sheet", detail: "Parents get it in the app.", href: "/academic", linkLabel: "Open academic", manual: true },
    { id: "admissions", title: "Place approved admissions", detail: "", href: "/admissions", linkLabel: "Open admissions", manual: false },
    { id: "downloads", title: "Download the promotion list and new class lists", detail: "One Excel file with both.", href: "/promotion", linkLabel: "Download", manual: true },
  ];
  if (r.leaving) items.splice(4, 0, { id: "certificates", title: "Issue transfer certificates", detail: "", href: "/students", linkLabel: "Open students", manual: false });
  return items;
}
