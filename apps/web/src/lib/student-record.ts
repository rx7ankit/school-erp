/**
 * Fuller student record (demo store). The `Student` type in mock.ts stays small; everything else
 * (photo, IDs, guardians, documents, certificates, lifecycle changes) lives here, keyed by student id.
 * Shapes follow docs/erd.md "Student record and certificates". Replace with API calls later.
 */
import * as React from "react";
import { SCHOOL, STUDENTS, className, eventsFor, type Student } from "./mock";
import { nowUTC, todayOnIST } from "./time";
import { logAudit } from "./audit";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"] as const;
export const RELATIONS = ["Father", "Mother", "Grandfather", "Grandmother", "Uncle", "Aunt", "Brother", "Sister", "Other"] as const;
export type DocKind = "birth_certificate" | "previous_tc" | "id_proof" | "photo" | "other";
export const DOC_LABEL: Record<DocKind, string> = { birth_certificate: "Birth certificate", previous_tc: "Previous school TC", id_proof: "ID proof", photo: "Photo", other: "Other" };
export type CertKind = "transfer" | "bonafide" | "character";
export const CERT_LABEL: Record<CertKind, string> = { transfer: "Transfer certificate", bonafide: "Bonafide certificate", character: "Character certificate" };
export const CERT_PREFIX: Record<CertKind, string> = { transfer: "TC", bonafide: "BON", character: "CHR" };
export const CONDUCT = ["Very good", "Good", "Satisfactory"] as const;

export interface ExtraGuardian { id: string; name: string; relation: string; phone: string; email?: string; occupation?: string; isEmergency: boolean; }
export interface StudentDocument { id: string; kind: DocKind; fileName: string; size: number; uploadedAt: string; uploadedBy: string; }
/** Everything printed on a certificate, frozen at issue time so a reprint is identical. */
export interface CertSnapshot {
  school: string; city: string; academicYear: string; studentName: string; gender: "M" | "F"; guardian: string; dob: string;
  className: string; scholarNo: string; admittedOn: string; leftOn?: string; leavingReason?: string; conduct?: string; purpose?: string;
}
export interface Certificate { id: string; studentId: string; kind: CertKind; number: string; issuedOn: string; issuedBy: string; reason: string; snapshot: CertSnapshot; }
export interface HistoryEntry { id: string; title: string; detail: string; on: string; tone: "brand" | "danger" | "neutral"; }
export interface Lifecycle { status: Student["status"]; leftOn?: string; leavingReason?: string; tcNumber?: string; }

export interface StudentRecord {
  photoUrl?: string; bloodGroup: string; category: string; samagraId: string; pen: string; previousSchool: string; medicalNotes: string;
  emergencyName: string; emergencyPhone: string;
  guardians: ExtraGuardian[]; documents: StudentDocument[]; certificates: Certificate[];
  lifecycle?: Lifecycle; history: HistoryEntry[];
}
export type DetailsInput = Pick<StudentRecord, "photoUrl" | "bloodGroup" | "category" | "samagraId" | "pen" | "previousSchool" | "medicalNotes" | "emergencyName" | "emergencyPhone">;

/* ---------- Validation ---------- */
const digits = (v: string) => v.replace(/\s/g, "");
export const isPhone = (v: string) => /^\d{10}$/.test(digits(v));
export function validateDetails(d: DetailsInput): Partial<Record<keyof DetailsInput, string>> {
  const e: Partial<Record<keyof DetailsInput, string>> = {};
  if (d.samagraId && !/^\d{8}$/.test(d.samagraId)) e.samagraId = "Samagra ID is 8 digits.";
  if (d.pen && !/^[A-Za-z0-9]{11}$/.test(d.pen)) e.pen = "PEN is 11 letters or digits.";
  if (d.emergencyPhone && !isPhone(d.emergencyPhone)) e.emergencyPhone = "Mobile should be 10 digits.";
  if (d.emergencyName && !d.emergencyPhone) e.emergencyPhone = "Add a mobile for this contact.";
  if (d.emergencyPhone && !d.emergencyName) e.emergencyName = "Add the contact's name.";
  return e;
}

/* ---------- Store ---------- */
const records = new Map<string, StudentRecord>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version += 1; listeners.forEach((l) => l()); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
let counter = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(counter += 1)}`;

/** Last number used per kind and year. Numbers only go up, so a number is never reused. */
const seq: Record<string, number> = { "TC-2026": 14, "BON-2026": 7, "CHR-2026": 3 };
const fmtNumber = (kind: CertKind, year: string, n: number) => `${CERT_PREFIX[kind]}-${year}-${String(n).padStart(3, "0")}`;
export const nextCertNumber = (kind: CertKind, on: string = todayOnIST()) => {
  const year = on.slice(0, 4);
  return fmtNumber(kind, year, (seq[`${CERT_PREFIX[kind]}-${year}`] ?? 0) + 1);
};
const takeCertNumber = (kind: CertKind, on: string) => {
  const key = `${CERT_PREFIX[kind]}-${on.slice(0, 4)}`;
  seq[key] = (seq[key] ?? 0) + 1;
  return fmtNumber(kind, on.slice(0, 4), seq[key]);
};

export function snapshotFor(s: Student, extra: Partial<CertSnapshot> = {}): CertSnapshot {
  return {
    school: SCHOOL.name, city: SCHOOL.city, academicYear: SCHOOL.year.replace("–", "-"), studentName: s.name, gender: s.gender, guardian: s.guardian,
    dob: s.dob, className: className(s.classId), scholarNo: s.scholarNo, admittedOn: eventsFor(s)[0].on, ...extra,
  };
}

const LAST_OF = (s: Student) => s.name.split(" ").slice(1).join(" ");
function seedFor(id: string): StudentRecord {
  const i = STUDENTS.findIndex((s) => s.id === id);
  const empty: StudentRecord = { bloodGroup: "", category: "", samagraId: "", pen: "", previousSchool: "", medicalNotes: "", emergencyName: "", emergencyPhone: "", guardians: [], documents: [], certificates: [], history: [] };
  if (i < 0) return empty;
  const s = STUDENTS[i];
  const mother = ["Sunita", "Rekha", "Meena", "Kiran"][i % 4];
  const hasEmergency = i % 4 !== 3;
  const rec: StudentRecord = {
    ...empty,
    bloodGroup: i % 5 === 4 ? "" : BLOOD_GROUPS[(i * 3) % BLOOD_GROUPS.length],
    category: ["General", "OBC", "General", "SC", "OBC", "General", "EWS", "ST"][i % 8],
    samagraId: String(41000000 + i * 7919),
    pen: `RW${100000000 + i * 7331}`,
    previousSchool: i % 3 === 0 ? "" : ["Saraswati Shishu Mandir, Rewa", "St. Mary's School, Satna", "Government Model School, Rewa", "Little Flower School, Rewa"][i % 4],
    medicalNotes: i % 9 === 2 ? "Mild asthma. Keeps an inhaler in the school bag." : i % 11 === 4 ? "Allergic to peanuts." : "",
    emergencyName: hasEmergency ? `${mother} ${LAST_OF(s)}` : "",
    emergencyPhone: hasEmergency ? `90000 ${50001 + i}` : "",
  };
  if (i % 2 === 0) rec.guardians = [{ id: `${id}-g1`, name: `${mother} ${LAST_OF(s)}`, relation: "Mother", phone: `90000 ${50001 + i}`, email: `${mother.toLowerCase()}.${i}@example.in`, occupation: i % 4 === 0 ? "Teacher" : "Homemaker", isEmergency: hasEmergency }];
  if (i % 6 === 1) rec.guardians.push({ id: `${id}-g2`, name: `Hari ${LAST_OF(s)}`, relation: "Grandfather", phone: `90000 ${60001 + i}`, isEmergency: false });
  if (i % 3 === 0) rec.documents = [{ id: `${id}-d1`, kind: "birth_certificate", fileName: `birth-certificate-${s.scholarNo}.pdf`, size: 184320 + i * 1000, uploadedAt: "2024-04-09T05:30:00Z", uploadedBy: "Meera Rao" }];
  if (i % 6 === 0) rec.documents.push({ id: `${id}-d2`, kind: "id_proof", fileName: `guardian-id-${s.scholarNo}.jpg`, size: 96400 + i * 500, uploadedAt: "2024-04-09T05:41:00Z", uploadedBy: "Meera Rao" });
  const mk = (n: string, kind: CertKind, on: string, reason: string, extra: Partial<CertSnapshot>): Certificate => ({ id: `${id}-c-${n}`, studentId: id, kind, number: n, issuedOn: on, issuedBy: "Meera Rao", reason, snapshot: snapshotFor(s, extra) });
  if (id === "st36") {
    rec.certificates = [mk("TC-2026-014", "transfer", "2026-09-15", s.leavingReason ?? "", { leftOn: s.leftOn, leavingReason: s.leavingReason, conduct: "Good" })];
  } else if (id === "st2") rec.certificates = [mk("BON-2026-006", "bonafide", "2026-08-20", "Bank account opening", { purpose: "Bank account opening" })];
  else if (id === "st5") rec.certificates = [mk("BON-2026-007", "bonafide", "2026-10-05", "Scholarship application", { purpose: "Scholarship application" })];
  else if (id === "st3") rec.certificates = [mk("CHR-2026-003", "character", "2026-09-02", "Passport application", { conduct: "Very good", purpose: "Passport application" })];
  return rec;
}

export function getRecord(id: string): StudentRecord {
  let r = records.get(id);
  if (!r) { r = seedFor(id); records.set(id, r); }
  return r;
}
const put = (id: string, patch: Partial<StudentRecord>) => { records.set(id, { ...getRecord(id), ...patch }); emit(); };

/** Subscribes to one student's record. */
export function useStudentRecord(id: string): StudentRecord {
  return React.useSyncExternalStore(subscribe, () => getRecord(id), () => getRecord(id));
}
/** Re-renders when any record changes (for lists). */
export function useRecordsVersion(): number {
  return React.useSyncExternalStore(subscribe, () => version, () => 0);
}

/** The student with any leaving/rejoining done in this session applied on top. */
export const applyLifecycle = (s: Student): Student => {
  const lc = getRecord(s.id).lifecycle;
  return lc ? { ...s, ...lc } : s;
};

export function createRecord(id: string, data: Partial<DetailsInput>) {
  const base = seedFor(id);
  records.set(id, { ...base, ...data });
  emit();
}
export const saveDetails = (id: string, d: DetailsInput) => put(id, d);

/* ---------- Missing details ---------- */
export function missingDetails(id: string): string[] {
  const r = getRecord(id);
  const out: string[] = [];
  if (!r.emergencyPhone && !r.guardians.some((g) => g.isEmergency)) out.push("Emergency contact");
  if (!r.bloodGroup) out.push("Blood group");
  if (!r.category) out.push("Category");
  return out;
}

/* ---------- Guardians ---------- */
export function saveGuardian(id: string, g: Omit<ExtraGuardian, "id"> & { id?: string }) {
  const list = getRecord(id).guardians;
  put(id, { guardians: g.id ? list.map((x) => (x.id === g.id ? { ...x, ...g, id: x.id } : x)) : [...list, { ...g, id: uid("g") }] });
}
export const removeGuardian = (id: string, gid: string) => put(id, { guardians: getRecord(id).guardians.filter((g) => g.id !== gid) });

/* ---------- Documents ---------- */
export const addDocument = (id: string, d: Omit<StudentDocument, "id" | "uploadedAt">) =>
  put(id, { documents: [{ ...d, id: uid("d"), uploadedAt: nowUTC() }, ...getRecord(id).documents] });
export const removeDocument = (id: string, did: string) => put(id, { documents: getRecord(id).documents.filter((d) => d.id !== did) });

/* ---------- Leaving, rejoining, certificates ---------- */
const addHistory = (id: string, e: Omit<HistoryEntry, "id">): HistoryEntry[] => [{ ...e, id: uid("h") }, ...getRecord(id).history];

export function markLeft(s: Student, input: { on: string; reason: string }) {
  logAudit({ category: "students", action: "student.left", summary: `Marked ${s.name} as left school. Reason: ${input.reason}`, entity: s.name, href: `/students/${s.id}`, sensitive: true, changes: [{ field: "Status", from: "Active", to: "Left school" }] });
  put(s.id, { lifecycle: { status: "left", leftOn: input.on, leavingReason: input.reason }, history: addHistory(s.id, { title: "Left school", detail: input.reason, on: input.on, tone: "danger" }) });
}
export function rejoin(s: Student) {
  logAudit({ category: "students", action: "student.rejoined", summary: `${s.name} rejoined the school`, entity: s.name, href: `/students/${s.id}`, sensitive: true, changes: [{ field: "Status", from: "Left school", to: "Active" }] });
  put(s.id, { lifecycle: { status: "active" }, history: addHistory(s.id, { title: "Rejoined", detail: "Enrolled again", on: todayOnIST(), tone: "brand" }) });
}

export interface IssueInput { kind: CertKind; reason: string; conduct?: string; issuedBy: string; }
export type IssueResult = { ok: true; certificate: Certificate } | { ok: false; error: string };

/** Rules: TC only once, for a leaving or left student (marks tc_issued). Bonafide and character only for active students. */
export function canIssue(s: Student, kind: CertKind): string | null {
  const hasTc = getRecord(s.id).certificates.some((c) => c.kind === "transfer") || !!s.tcNumber;
  if (kind === "transfer") {
    if (s.status === "active") return "A transfer certificate is only for a student who is leaving or has left. Mark the student as left first.";
    if (hasTc) return "A transfer certificate was already issued. Reprint it instead.";
    return null;
  }
  return s.status === "active" ? null : "This certificate is only for active students.";
}

export function issueCertificate(s: Student, input: IssueInput): IssueResult {
  const blocked = canIssue(s, input.kind);
  if (blocked) return { ok: false, error: blocked };
  const on = todayOnIST();
  const number = takeCertNumber(input.kind, on);
  const isTc = input.kind === "transfer";
  const snapshot = snapshotFor(s, {
    conduct: input.kind === "bonafide" ? undefined : input.conduct ?? "Good",
    ...(isTc ? { leftOn: s.leftOn ?? on, leavingReason: input.reason } : { purpose: input.reason }),
  });
  const certificate: Certificate = { id: uid("c"), studentId: s.id, kind: input.kind, number, issuedOn: on, issuedBy: input.issuedBy, reason: input.reason, snapshot };
  const rec = getRecord(s.id);
  put(s.id, {
    certificates: [certificate, ...rec.certificates],
    ...(isTc ? {
      lifecycle: { status: "tc_issued", leftOn: s.leftOn ?? on, leavingReason: s.leavingReason ?? input.reason, tcNumber: number },
      history: addHistory(s.id, { title: "Transfer certificate issued", detail: `${number} · ${input.issuedBy}`, on, tone: "danger" }),
    } : {}),
  });
  logAudit({ category: "students", action: "certificate.issued", summary: `Issued ${input.kind} certificate ${number} for ${s.name}`, entity: number, href: `/students/${s.id}`, sensitive: true });
  return { ok: true, certificate };
}
