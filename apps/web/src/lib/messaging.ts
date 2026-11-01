"use client";
import * as React from "react";
import { logAudit } from "./audit";
import { CLASSES, STAFF, STUDENTS, className, type Student } from "./mock";
import { notify } from "./notifications";
import { nowUTC } from "./time";

/**
 * Unified messaging (docs/erd.md, "v7: Unified messaging").
 *  - Broadcasts: school-level (admin or academic.manage) and class-level (assigned teachers). Parents only read them.
 *  - Threads: one private thread per child, teacher and subject, keyed `${studentId}:${staffId}:${subject}`.
 *
 * Only messages and broadcasts are stored. Whether a thread is active is DERIVED on every render from STAFF[].classes,
 * so changing an assignment never deletes or migrates anything.
 * Backed by localStorage so a teacher in one tab and a parent in another see the same data.
 */
export interface Broadcast {
  id: string;
  scope: "school" | "class";
  /** Class scope: the class(es). School scope: the chosen classes, or empty for the whole school. */
  classIds: string[];
  /** "School" for school-level, a subject name, or "General". */
  subject: string;
  senderId: string;
  senderName: string;
  body: string;
  file?: string;
  sentAt: string;
}
export interface ThreadMessage { id: string; from: "parent" | "staff"; body: string; at: string; }
export type Result = { ok: true } | { ok: false; error: string };

export const SCHOOL_SUBJECT = "School";
export const GENERAL = "General";
export const BODY_MAX = 1000;

/* ---------- Seeds ---------- */
const SEED_BROADCASTS: Broadcast[] = [
  { id: "bs-sports", scope: "school", classIds: [], subject: SCHOOL_SUBJECT, senderId: "s1", senderName: "Meera Rao", body: "Annual Sports Day is on 12 December. Students report by 7:30 am in house colours. Parents are welcome from 9:00 am.", sentAt: "2026-10-31T10:30:00Z" },
  { id: "bs-exams", scope: "school", classIds: ["c8a", "c8b", "c9a", "c10a"], subject: SCHOOL_SUBJECT, senderId: "s4", senderName: "Anil Shukla", body: "Half-yearly exams begin on 23 November for classes 8 to 10. Syllabus lists are with the class teachers.", sentAt: "2026-10-29T06:00:00Z" },
  { id: "bc1", scope: "class", classIds: ["c8b"], subject: "Mathematics", senderId: "s5", senderName: "Rajiv Mishra", body: "Chapter 7 practice sheet attached. Please revise before Friday's test.", sentAt: "2026-10-31T09:20:00Z", file: "Math-Practice-Sheet.pdf" },
  { id: "bc2", scope: "class", classIds: ["c8b"], subject: "English", senderId: "s6", senderName: "Sunita Dwivedi", body: "Book review is due on Monday. Two pages is enough.", sentAt: "2026-10-30T06:10:00Z" },
  { id: "bc3", scope: "class", classIds: ["c9a"], subject: "Science", senderId: "s7", senderName: "Farhan Khan", body: "Project guidelines attached. Groups of three.", sentAt: "2026-10-28T06:30:00Z", file: "Science-Project.pdf" },
  { id: "bc4", scope: "class", classIds: ["c6a"], subject: GENERAL, senderId: "s6", senderName: "Sunita Dwivedi", body: "PTM slots are open for booking this week.", sentAt: "2026-10-30T07:05:00Z" },
  { id: "bc5", scope: "class", classIds: ["c7a"], subject: "Hindi", senderId: "s8", senderName: "Pooja Singh", body: "Poem recitation on Saturday. Every child learns four lines of 'Madhushala' by heart.", sentAt: "2026-10-31T05:45:00Z" },
  { id: "bc6", scope: "class", classIds: ["c8a"], subject: "Science", senderId: "s7", senderName: "Farhan Khan", body: "Bring a chart paper and colours for the model-making activity on Wednesday.", sentAt: "2026-10-30T08:10:00Z" },
];
const M = (id: string, from: "parent" | "staff", at: string, body: string): ThreadMessage => ({ id, from, body, at });
const SEED_MESSAGES: Record<string, ThreadMessage[]> = {
  "st1:s6:English": [
    M("m10", "staff", "2026-10-30T07:30:00Z", "Sports practice starts on Monday at 7:30 am."),
    M("m11", "parent", "2026-10-30T07:40:00Z", "Aarav will join the sports practice."),
  ],
  "st2:s8:Hindi": [
    M("m20", "staff", "2026-10-31T06:10:00Z", "Ananya recited very well today. Please ask her to practise the poem once more for Saturday."),
    M("m21", "parent", "2026-10-31T11:30:00Z", "Thank you, ma'am. She will practise tonight."),
    M("m22", "staff", "2026-11-01T03:20:00Z", "Please send her Hindi notebook with her tomorrow."),
  ],
  "st9:s7:Science": [
    M("m30", "parent", "2026-10-29T12:00:00Z", "Sir, can Arjun get the model-making material list?"),
    M("m31", "staff", "2026-10-30T08:20:00Z", "A chart paper, colours and glue are enough. He can work with a partner."),
    M("m32", "parent", "2026-10-30T09:05:00Z", "Thank you, sir. We will arrange it."),
    M("m33", "staff", "2026-10-31T10:15:00Z", "Arjun's last test was very good. Keep it up."),
  ],
  "st4:s5:Mathematics": [
    M("m5", "staff", "2026-10-29T12:30:00Z", "Diya has missed two tests. Could we meet this week?"),
    M("m6", "parent", "2026-10-29T12:45:00Z", "Thank you, sir. We will meet on Saturday."),
  ],
  "st10:s5:Mathematics": [
    M("m8", "staff", "2026-10-27T10:05:00Z", "Her handwriting has improved a lot this month."),
    M("m9", "parent", "2026-10-27T10:15:00Z", "Sure, I will check her notebook today."),
  ],
  "st4:s6:English": [
    M("m40", "staff", "2026-10-24T05:30:00Z", "Diya's book review was thoughtful. She can try a longer essay next time."),
    M("m41", "parent", "2026-10-24T08:10:00Z", "Thank you, ma'am. We will encourage her."),
  ],
  // Historic thread: Anita Joshi taught English to 8-B earlier and has no class now, so this thread is inactive.
  "st4:s11:English": [
    M("m50", "parent", "2026-08-12T09:00:00Z", "Ma'am, Diya finds the grammar exercises hard. Can she get some extra practice?"),
    M("m51", "staff", "2026-08-12T10:20:00Z", "Yes. I will give her an extra worksheet every Friday."),
    M("m52", "parent", "2026-09-05T08:40:00Z", "She enjoyed the worksheets. Thank you for your help."),
    M("m53", "staff", "2026-09-05T11:00:00Z", "Glad to hear it. She is improving steadily."),
  ],
};

/* ---------- Store ---------- */
interface Stored { broadcasts: Broadcast[]; messages: Record<string, ThreadMessage[]>; }
const KEY = "scool.messaging";
const READ_KEY = "scool.messaging.read";
const EVT = "scool:messaging";
const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
const rawOf = (k: string) => () => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const rawStore = rawOf(KEY);
const rawReads = rawOf(READ_KEY);
function parse<T>(s: string, fallback: T): T { try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } }
const readStored = (): Stored => { const s = parse<Partial<Stored>>(rawStore(), {}); return { broadcasts: s.broadcasts ?? [], messages: s.messages ?? {} }; };
function writeStored(next: Stored) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event(EVT));
}
function merge(stored: Stored): { broadcasts: Broadcast[]; messages: Record<string, ThreadMessage[]> } {
  const broadcasts = [...stored.broadcasts, ...SEED_BROADCASTS].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const messages: Record<string, ThreadMessage[]> = {};
  for (const k of new Set([...Object.keys(SEED_MESSAGES), ...Object.keys(stored.messages)])) {
    messages[k] = [...(SEED_MESSAGES[k] ?? []), ...(stored.messages[k] ?? [])].sort((a, b) => a.at.localeCompare(b.at));
  }
  return { broadcasts, messages };
}

export interface MessagingState { broadcasts: Broadcast[]; messages: Record<string, ThreadMessage[]>; reads: Record<string, string>; }
/** Every broadcast (newest first), every thread's messages (oldest first) and the read marks. Re-renders on any tab's change. */
export function useMessaging(): MessagingState {
  const s = React.useSyncExternalStore(subscribe, rawStore, () => "");
  const r = React.useSyncExternalStore(subscribe, rawReads, () => "");
  return React.useMemo(() => {
    const st = parse<Partial<Stored>>(s, {});
    return { ...merge({ broadcasts: st.broadcasts ?? [], messages: st.messages ?? {} }), reads: parse<Record<string, string>>(r, {}) };
  }, [s, r]);
}

/* ---------- Read state (per child for parents, per teacher for staff) ---------- */
/** Items older than this count as already read, so a fresh demo does not start with everything unread. */
export const READ_BASELINE = "2026-10-31T00:00:00Z";
export const updatesReadKey = (studentId: string) => `updates:${studentId}`;
export const threadReadKey = (viewer: "parent" | "staff", key: string) => `${viewer}:${key}`;
export const lastReadAt = (reads: Record<string, string>, id: string) => reads[id] ?? READ_BASELINE;
export function markRead(id: string) {
  const reads = parse<Record<string, string>>(rawReads(), {});
  const at = nowUTC();
  if (reads[id] && reads[id] >= at) return;
  try { localStorage.setItem(READ_KEY, JSON.stringify({ ...reads, [id]: at })); } catch {}
  window.dispatchEvent(new Event(EVT));
}

/* ---------- Derived: threads ---------- */
export const subjectOf = (a: { subject?: string }) => a.subject?.trim() || GENERAL;
export const threadKey = (studentId: string, staffId: string, subject: string) => `${studentId}:${staffId}:${subject}`;
export function parseKey(key: string): { studentId: string; staffId: string; subject: string } {
  const [studentId = "", staffId = "", ...rest] = key.split(":");
  return { studentId, staffId, subject: rest.join(":") };
}
/** Is this teacher assigned to the child's class for that subject right now? (A class teacher counts under their own subject.) */
export const isAssigned = (student: Student, staffId: string, subject: string) =>
  !!STAFF.find((s) => s.id === staffId)?.classes.some((c) => c.classId === student.classId && subjectOf(c) === subject);

export interface ThreadInfo {
  key: string; studentId: string; staffId: string; staffName: string; subject: string;
  classTeacher: boolean; status: "active" | "inactive"; reason?: string;
  messages: ThreadMessage[]; last?: ThreadMessage;
}
function info(student: Student, staffId: string, staffName: string, subject: string, classTeacher: boolean, active: boolean, messages: Record<string, ThreadMessage[]>): ThreadInfo {
  const key = threadKey(student.id, staffId, subject);
  const list = messages[key] ?? [];
  return { key, studentId: student.id, staffId, staffName, subject, classTeacher, status: active ? "active" : "inactive", reason: active ? undefined : `No longer teaches ${subject}`, messages: list, last: list.at(-1) };
}

/** A child's threads: every teacher assigned to the class (class teacher first), then historic threads of teachers who no longer teach them. */
export function threadsForChild(student: Student, messages: Record<string, ThreadMessage[]>): ThreadInfo[] {
  const active: ThreadInfo[] = [];
  for (const st of STAFF) for (const c of st.classes) {
    if (c.classId === student.classId) active.push(info(student, st.id, st.name, subjectOf(c), c.role === "class_teacher", true, messages));
  }
  active.sort((a, b) => Number(b.classTeacher) - Number(a.classTeacher) || a.staffName.localeCompare(b.staffName) || a.subject.localeCompare(b.subject));
  const live = new Set(active.map((t) => t.key));
  const old = Object.keys(messages)
    .filter((k) => parseKey(k).studentId === student.id && !live.has(k) && messages[k].length > 0)
    .map((k) => { const p = parseKey(k); return info(student, p.staffId, STAFF.find((s) => s.id === p.staffId)?.name ?? "Former teacher", p.subject, false, false, messages); })
    .sort((a, b) => (b.last?.at ?? "").localeCompare(a.last?.at ?? ""));
  return [...active, ...old];
}

/** What a teacher sees: active threads for students of the classes and subjects they currently have. Threads they no longer have are hidden. */
export function threadsForStaff(staffId: string, messages: Record<string, ThreadMessage[]>): (ThreadInfo & { classId: string })[] {
  const me = STAFF.find((s) => s.id === staffId);
  if (!me) return [];
  const out: (ThreadInfo & { classId: string })[] = [];
  for (const c of me.classes) for (const st of STUDENTS) {
    if (st.classId !== c.classId || st.status !== "active") continue;
    out.push({ ...info(st, me.id, me.name, subjectOf(c), c.role === "class_teacher", true, messages), classId: c.classId });
  }
  return out;
}
/** Threads that exist (have messages), most recent first, for the staff list. */
export const withMessages = <T extends ThreadInfo>(list: T[]) => list.filter((t) => t.messages.length > 0);

export function unreadCount(t: ThreadInfo, viewer: "parent" | "staff", reads: Record<string, string>): number {
  const since = lastReadAt(reads, threadReadKey(viewer, t.key));
  const other = viewer === "parent" ? "staff" : "parent";
  return t.messages.filter((m) => m.from === other && m.at > since).length;
}

/* ---------- Derived: updates ---------- */
export const coversClass = (b: Broadcast, classId: string) => b.classIds.length === 0 ? b.scope === "school" : b.classIds.includes(classId);
/** School broadcasts that cover the child's class plus that class's own broadcasts, newest first. */
export const updatesFor = (student: Student, broadcasts: Broadcast[]) =>
  broadcasts.filter((b) => coversClass(b, student.classId)).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
export const updatesUnread = (student: Student, broadcasts: Broadcast[], reads: Record<string, string>) => {
  const since = lastReadAt(reads, updatesReadKey(student.id));
  return updatesFor(student, broadcasts).filter((b) => b.sentAt > since).length;
};

/* ---------- Actions ---------- */
const preview = (s: string, n = 80) => { const t = s.replace(/\s+/g, " ").trim(); return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`; };
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Active students a broadcast reaches. School scope with no classes means the whole school. */
export function audienceOf(scope: "school" | "class", classIds: string[]): Student[] {
  const ids = scope === "school" && classIds.length === 0 ? CLASSES.map((c) => c.id) : classIds;
  return STUDENTS.filter((s) => s.status === "active" && ids.includes(s.classId));
}
const scopeLabel = (scope: "school" | "class", classIds: string[]) =>
  scope === "school" && classIds.length === 0 ? "Whole school" : `Class ${classIds.map(className).join(", ")}`;

export interface BroadcastInput { scope: "school" | "class"; classIds: string[]; subject: string; body: string; file?: string; sender: { id: string; name: string }; }
export function sendBroadcast(input: BroadcastInput): { ok: true; broadcast: Broadcast; count: number } | { ok: false; error: string } {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write the message first." };
  if (body.length > BODY_MAX) return { ok: false, error: `Keep the message within ${BODY_MAX} characters.` };
  if (input.scope === "class" && input.classIds.length !== 1) return { ok: false, error: "Choose a class." };
  const school = input.scope === "school";
  const subject = school ? SCHOOL_SUBJECT : input.subject || GENERAL;
  const broadcast: Broadcast = { id: `bx-${uid()}`, scope: input.scope, classIds: input.classIds, subject, senderId: input.sender.id, senderName: input.sender.name, body, file: input.file, sentAt: nowUTC() };
  const cur = readStored();
  writeStored({ ...cur, broadcasts: [broadcast, ...cur.broadcasts] });
  const audience = audienceOf(input.scope, input.classIds);
  notify(audience.map((s) => ({ type: "broadcast" as const, studentId: s.id, params: { title: school ? "School notice" : `${input.sender.name} · ${subject}`, body: preview(body) } })));
  logAudit({
    category: "messages", action: "broadcast.sent", entity: scopeLabel(input.scope, input.classIds),
    summary: school ? `${input.classIds.length === 0 ? "School-wide broadcast" : `Broadcast to ${scopeLabel(input.scope, input.classIds)}`}: "${preview(body, 60)}"` : `Broadcast to ${scopeLabel(input.scope, input.classIds)} (${subject}): "${preview(body, 60)}"`,
  });
  return { ok: true, broadcast, count: audience.length };
}

/** Add a message to a thread. Rejected when the teacher no longer teaches the child that subject, or the child has left. */
export function sendThreadMessage(key: string, from: "parent" | "staff", text: string): Result {
  const body = text.trim();
  if (!body) return { ok: false, error: "Write a message first." };
  if (body.length > BODY_MAX) return { ok: false, error: `Keep the message within ${BODY_MAX} characters.` };
  const { studentId, staffId, subject } = parseKey(key);
  const student = STUDENTS.find((s) => s.id === studentId);
  const staff = STAFF.find((s) => s.id === staffId);
  if (!student || !staff) return { ok: false, error: "This conversation no longer exists." };
  if (student.status !== "active") return { ok: false, error: `${student.name.split(" ")[0]} has left school, so this conversation is read-only.` };
  if (!isAssigned(student, staffId, subject)) return { ok: false, error: `${staff.name} no longer teaches ${subject} to ${student.name.split(" ")[0]}.` };
  const cur = readStored();
  const msg: ThreadMessage = { id: `mx-${uid()}`, from, body, at: nowUTC() };
  writeStored({ ...cur, messages: { ...cur.messages, [key]: [...(cur.messages[key] ?? []), msg] } });
  if (from === "staff") notify([{ type: "message", studentId, params: { title: staff.name, body: preview(body) } }]);
  logAudit({
    category: "messages", action: "message.sent", entity: student.name,
    summary: from === "staff" ? `Messaged the parent of ${student.name} (${subject}): "${preview(body, 60)}"` : `Parent of ${student.name} wrote to ${staff.name} (${subject})`,
    actorName: from === "parent" ? student.guardian : undefined, actorRole: from === "parent" ? "Parent" : undefined,
  });
  return { ok: true };
}
