import { activeStudents } from "./rollover-plan";
import { getAcademic, publicationOf } from "./academic-setup";
import { classTeacherOf } from "./assignments";
import { owedOf } from "./fees-setup";
import { allLeaves } from "./leave";
import { CLASSES, INVOICES } from "./mock";
import { missingDetails } from "./student-record";
import type { ReadinessResult } from "./rollover-types";

/**
 * Step 0: warnings, never blockers. Each one has a screen where it can be fixed.
 * Reads the live stores, so call it during render or on click, not at import time.
 */
export function checkReadiness(): ReadinessResult {
  const live = new Set(CLASSES.map((c) => c.id));
  const unpublished = getAcademic().exams
    .map((e) => ({ examId: e.id, examName: e.name, classIds: e.classIds.filter((c) => live.has(c) && !publicationOf(e.id, c)) }))
    .filter((e) => e.classIds.length > 0);
  const pendingLeaves = allLeaves().filter((l) => l.status === "pending").length;
  const active = new Set(activeStudents().map((s) => s.id));
  const owing = new Map<string, number>();
  for (const i of INVOICES) if (active.has(i.studentId)) { const o = owedOf(i); if (o > 0) owing.set(i.studentId, (owing.get(i.studentId) ?? 0) + o); }
  const unpaid = { students: owing.size, paise: [...owing.values()].reduce((a, b) => a + b, 0) };
  const noClassTeacher = CLASSES.filter((c) => !classTeacherOf(c.id)).map((c) => c.id);
  const missing = activeStudents().filter((s) => missingDetails(s.id).includes("Emergency contact")).length;
  const issues = (unpublished.length ? 1 : 0) + (pendingLeaves ? 1 : 0) + (unpaid.students ? 1 : 0) + (noClassTeacher.length ? 1 : 0) + (missing ? 1 : 0);
  return { unpublished, pendingLeaves, unpaid, noClassTeacher, missingDetails: missing, issues };
}
