/**
 * Year-end rollover: the shapes shared by the draft, the plan, the check and the apply step.
 * Docs: docs/year-rollover.md. Money is paise. Dates are IST calendar dates.
 */
import type { Frequency } from "./fees-setup";

export type Decision = "promote" | "stay" | "leave";
/** Where a class goes next year. null means the class completes school (passed out). */
export type Dest = { grade: string; section: string } | null;
export type TeacherMode = "same" | "move_up" | "empty";

/** Teacher choices the user changed by hand. Anything missing follows the chosen starting point. */
export interface TeacherOverride { ct?: string | null; subjects?: Record<string, string | null>; }

export interface FeePlan {
  newHeads: { id: string; name: string; frequency: Frequency }[];
  removedHeads: string[];
  /** Amounts the user changed, by class key then head id (paise). Missing cells follow last year's amount for that grade. */
  grid: Record<string, Record<string, number>>;
  /** Carry each concession over to next year, by concession id. Missing follows the default. */
  carry: Record<string, boolean>;
  dues: "carry" | "writeoff";
  writeoffReason: string;
  invoices: "now" | "later";
  period: string;
  dueOn: string;
}

export interface RolloverDraft {
  version: 1;
  id: string;
  fromYearId: string;
  fromLabel: string;
  step: number;
  savedAt: string;
  savedBy: string;
  decisions: Record<string, Decision>;
  dest: Record<string, Dest>;
  keepOrder: boolean;
  /** Only show this class on the Students step (opened from a class card). */
  focusClassId?: string;
  year: { label: string; fromOn: string; toOn: string };
  extraClasses: string[];
  removedClasses: string[];
  capacity: Record<string, number>;
  newSubjects: { name: string; code: string }[];
  /** Subject names per class key, only for classes the user changed. */
  classSubjects: Record<string, string[]>;
  teacherMode: TeacherMode;
  teachers: Record<string, TeacherOverride>;
  timetable: "copy" | "empty";
  fees: FeePlan;
  ack: boolean;
}

/** One class of the new year, as the plan sees it. */
export interface PlanClass {
  key: string;
  grade: string;
  section: string;
  order: number;
  custom: boolean;
  capacity: number;
  promoted: number;
  stayed: number;
  total: number;
  /** Empty section kept for new admissions because nobody moves into this grade. */
  fresh: boolean;
  extra: boolean;
  /** Last year's class with the same grade and section. */
  sameSource?: string;
  /** Last year's class most of whose students move here. */
  upSource?: string;
}

export type Fate =
  | { kind: "class"; key: string; how: "promoted" | "stayed" }
  | { kind: "passed_out" }
  | { kind: "left" };

export interface ReadinessResult {
  unpublished: { examId: string; examName: string; classIds: string[] }[];
  pendingLeaves: number;
  unpaid: { students: number; paise: number };
  noClassTeacher: string[];
  missingDetails: number;
  issues: number;
}

export interface RolloverPreview {
  promoted: number; stayed: number; leaving: number; passedOut: number; total: number;
  newClasses: number; freshClasses: number;
  subjectTicks: number; newSubjects: number;
  slotsFilled: number; slotsTotal: number;
  feeByClass: { key: string; label: string; students: number; perStudentPaise: number }[];
  feesTotalPaise: number;
  duesStudents: number; duesPaise: number;
  /** Dues of students who continue (carried or written off) and of students who leave or pass out (stay on their old invoices). */
  duesMovingPaise: number; duesMovingStudents: number; duesStayingPaise: number;
  invoicesNow: boolean; invoiceStudents: number;
  parentsNotified: number; studentsNotified: number;
  warnings: string[];
}

export interface ChecklistItem {
  id: "teachers" | "timetable" | "invoices" | "datesheet" | "downloads" | "certificates";
  title: string;
  detail: string;
  href: string;
  linkLabel: string;
  /** Items without a live rule are ticked by hand. */
  manual: boolean;
}

export interface PromotionRow { scholarNo: string; name: string; from: string; outcome: string; to: string; roll: number | null; guardian: string; phone: string; }

export interface RolloverResult {
  appliedAt: string;
  appliedBy: string;
  fromLabel: string;
  toLabel: string;
  promoted: number; stayed: number; leaving: number; passedOut: number;
  newClasses: number; subjects: number;
  slotsFilled: number; slotsTotal: number;
  duesCarriedPaise: number; duesWrittenOffPaise: number;
  invoicesCreated: number; invoicePeriod: string | null; timetableSlots: number; notified: number;
  leavingIds: string[];
  rows: PromotionRow[];
  checklist: ChecklistItem[];
}
