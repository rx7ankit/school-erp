/** Demo data for teacher feedback. Answers are anonymous: the real API never returns who answered. */
import { CLASSES, STAFF } from "./mock";

export interface FeedbackRequest { id: string; title: string; opensOn: string; closesOn: string; status: "open" | "closed"; classIds: string[]; shared: boolean; }
export interface FeedbackTarget { id: string; requestId: string; staffId: string; classId: string; subject: string; isClassTeacher: boolean; }

export const FEEDBACK_REQUESTS: FeedbackRequest[] = [
  { id: "fb2", title: "Mid-term teacher feedback", opensOn: "2026-10-26", closesOn: "2026-11-20", status: "open", classIds: CLASSES.map((c) => c.id), shared: false },
  { id: "fb1", title: "Term 1 teacher feedback", opensOn: "2026-07-20", closesOn: "2026-08-05", status: "closed", classIds: CLASSES.map((c) => c.id), shared: true },
];

export function targetsFor(req: FeedbackRequest, classId?: string): FeedbackTarget[] {
  return STAFF.flatMap((s) => s.classes
    .filter((c) => req.classIds.includes(c.classId) && (!classId || c.classId === classId))
    .map((c) => ({ id: `${req.id}-${s.id}-${c.classId}`, requestId: req.id, staffId: s.id, classId: c.classId, subject: c.subject ?? "General", isClassTeacher: c.role === "class_teacher" })));
}

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);
const COMMENTS = [
  "Explains difficult topics patiently. My child enjoys the class.",
  "Homework is useful, but sometimes too much before tests.",
  "Very approachable. Always replies to our messages.",
  "Please give more practice sheets before exams.",
  "My child feels confident in this subject now.",
  "Classes sometimes start late.",
  "Great encouragement for weaker students.",
  "Would like more updates about progress.",
];

/** Stable demo summary for one target. */
export function summaryFor(t: FeedbackTarget, closed: boolean) {
  const h = hash(t.id);
  const total = closed ? 4 + (h % 3) : 2 + (h % 3); // answers received so far (demo: parents of 6 children per class)
  const base = 3.3 + (h % 17) / 10; // 3.3 to 4.9
  const spread = [0, 0, 0, 0, 0];
  for (let i = 0; i < total; i++) { const r = Math.max(1, Math.min(5, Math.round(base + (((h >> i) % 3) - 1)))); spread[r - 1]++; }
  const avg = spread.reduce((a, n, i) => a + n * (i + 1), 0) / total;
  const comments = Array.from({ length: Math.min(total, 3) }, (_, i) => COMMENTS[(h + i * 3) % COMMENTS.length]);
  return { count: total, avg: Math.round(avg * 10) / 10, spread, comments };
}

export function requestSummary(req: FeedbackRequest) {
  const ts = targetsFor(req);
  const sums = ts.map((t) => summaryFor(t, req.status === "closed"));
  const answers = sums.reduce((a, s) => a + s.count, 0);
  const avg = sums.length ? Math.round((sums.reduce((a, s) => a + s.avg * s.count, 0) / Math.max(1, answers)) * 10) / 10 : 0;
  const classes = new Set(req.classIds);
  const parents = CLASSES.filter((c) => classes.has(c.id)).length * 6; // demo: 6 parents per class
  const responded = Math.min(parents, Math.round(answers / Math.max(1, ts.length / classes.size)));
  return { targets: ts.length, answers, avg, parents, responded, rate: parents ? Math.round((responded / parents) * 100) : 0 };
}

/** Latest rating a teacher can see: only from requests the school chose to share. */
export function sharedRatingFor(staffId: string): number | null {
  const shared = FEEDBACK_REQUESTS.filter((r) => r.shared && r.status === "closed");
  const sums = shared.flatMap((r) => targetsFor(r).filter((t) => t.staffId === staffId).map((t) => summaryFor(t, true)));
  if (!sums.length) return null;
  const n = sums.reduce((a, s) => a + s.count, 0);
  return Math.round((sums.reduce((a, s) => a + s.avg * s.count, 0) / n) * 10) / 10;
}
