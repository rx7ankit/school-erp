/**
 * Demo data. Replace with API calls once the FastAPI backend exists.
 * Shapes follow docs/erd.md: `*_at` are UTC ISO strings, `*_on` are IST calendar dates, money is paise.
 */
import type { StaffUser } from "./permissions";

export const SCHOOL = { name: "Rewa Public School", city: "Rewa, Madhya Pradesh", year: "2026–27" };

export const CLASSES = [
  { id: "c6a", grade: "6", section: "A" },
  { id: "c7a", grade: "7", section: "A" },
  { id: "c8a", grade: "8", section: "A" },
  { id: "c8b", grade: "8", section: "B" },
  { id: "c9a", grade: "9", section: "A" },
  { id: "c10a", grade: "10", section: "A" },
] as const;
export const className = (id: string) => {
  const c = CLASSES.find((x) => x.id === id);
  return c ? `${c.grade}-${c.section}` : "—";
};

/* ---------- Staff (also the demo log-in personas) ---------- */
export interface StaffRow extends StaffUser {
  employeeCode: string;
  department: string;
  phone: string;
  joinedOn: string;
  absentToday?: string; // reason
  email?: string; // set for every staff member at load
  invite?: "not_sent" | "sent" | "active";
  inviteSentAt?: string;
}
export const STAFF: StaffRow[] = [
  { id: "s1", name: "Meera Rao", designation: "Principal", isAdmin: true, permissions: [], classes: [], employeeCode: "EMP001", department: "Administration", phone: "90000 20001", joinedOn: "2014-06-16" },
  { id: "s2", name: "Suresh Tiwari", designation: "Accountant", isAdmin: false, permissions: ["fees.manage"], classes: [], employeeCode: "EMP002", department: "Accounts", phone: "90000 20002", joinedOn: "2016-04-04" },
  { id: "s3", name: "Kavita Pandey", designation: "Librarian", isAdmin: false, permissions: ["library.manage"], classes: [], employeeCode: "EMP003", department: "Library", phone: "90000 20003", joinedOn: "2018-07-02" },
  { id: "s4", name: "Anil Shukla", designation: "Vice Principal", isAdmin: false, permissions: ["academic.manage", "staff.manage"], classes: [], employeeCode: "EMP004", department: "Administration", phone: "90000 20004", joinedOn: "2012-06-18" },
  { id: "s5", name: "Rajiv Mishra", designation: "Mathematics Teacher", isAdmin: false, permissions: [], classes: [{ classId: "c8b", role: "class_teacher" }, { classId: "c9a", role: "subject_teacher" }], employeeCode: "EMP005", department: "Mathematics", phone: "90000 20005", joinedOn: "2017-06-19" },
  { id: "s6", name: "Sunita Dwivedi", designation: "English Teacher", isAdmin: false, permissions: [], classes: [{ classId: "c6a", role: "class_teacher" }, { classId: "c8b", role: "subject_teacher" }], employeeCode: "EMP006", department: "English", phone: "90000 20006", joinedOn: "2019-07-01" },
  { id: "s7", name: "Farhan Khan", designation: "Science Teacher", isAdmin: false, permissions: [], classes: [{ classId: "c8a", role: "class_teacher" }, { classId: "c8b", role: "subject_teacher" }, { classId: "c9a", role: "subject_teacher" }], employeeCode: "EMP007", department: "Science", phone: "90000 20007", joinedOn: "2020-06-15", absentToday: "Medical leave" },
  { id: "s8", name: "Pooja Singh", designation: "Hindi Teacher", isAdmin: false, permissions: [], classes: [{ classId: "c7a", role: "class_teacher" }], employeeCode: "EMP008", department: "Hindi", phone: "90000 20008", joinedOn: "2015-07-06" },
  { id: "s9", name: "Dinesh Gupta", designation: "Social Science Teacher", isAdmin: false, permissions: ["library.manage"], classes: [{ classId: "c9a", role: "class_teacher" }], employeeCode: "EMP009", department: "Social Science", phone: "90000 20009", joinedOn: "2013-06-17" },
  { id: "s10", name: "Neha Agrawal", designation: "Computer Teacher", isAdmin: false, permissions: [], classes: [{ classId: "c10a", role: "class_teacher" }], employeeCode: "EMP010", department: "Computer Science", phone: "90000 20010", joinedOn: "2021-07-05" },
];

STAFF.forEach((t) => { t.email = `${t.name.toLowerCase().replace(/[^a-z ]/g, "").replace(" ", ".")}@rewapublic.example`; t.invite = "active"; });
const SUBJECT_OF: Record<string, string> = { s5: "Mathematics", s6: "English", s7: "Science", s8: "Hindi", s9: "Social Science", s10: "Computer" };
STAFF.forEach((t) => { t.classes = t.classes.map((c) => ({ ...c, subject: SUBJECT_OF[t.id] })); });

/* ---------- Students ---------- */
export const SUBJECTS_ALL = ["Mathematics", "English", "Hindi", "Science", "Social Science", "Computer"];
const FIRST = ["Aarav","Ananya","Vivaan","Diya","Aditya","Ishita","Kabir","Riya","Arjun","Saanvi","Rohan","Priya","Harsh","Muskan","Yash","Nisha","Kartik","Sneha","Dev","Pari","Ayush","Khushi","Om","Tanvi","Shreyas","Kritika","Lakshya","Mahi","Nitin","Palak","Rudra","Simran","Tejas","Urvi","Vedant","Zoya"];
const LAST = ["Tiwari","Mishra","Shukla","Pandey","Dwivedi","Singh","Gupta","Agrawal","Patel","Soni","Kushwaha","Vishwakarma","Baghel","Khan","Tripathi","Rajak","Pathak","Sahu","Chaturvedi","Namdeo"];
const AREAS = ["Civil Lines","Chorhata","Ganga Nagar","Shiv Nagar","Padra","Lakshmanbagh","Ramnagar Road","Hospital Chowk"];

export interface Student {
  id: string; scholarNo: string; name: string; classId: string; rollNo: number; gender: "M" | "F";
  dob: string; guardian: string; guardianEmail: string; phone: string; address: string;
  status: "active" | "left" | "tc_issued"; leftOn?: string; leavingReason?: string; tcNumber?: string;
}
export const STUDENTS: Student[] = FIRST.map((f, i) => {
  const classId = CLASSES[i % CLASSES.length].id;
  const last = LAST[(i * 7) % LAST.length];
  const roll = Math.floor(i / CLASSES.length) + 1;
  return {
    id: `st${i + 1}`, scholarNo: `RPS${2000 + i + 1}`, name: `${f} ${last}`, classId, rollNo: roll,
    gender: ["Aarav","Vivaan","Aditya","Kabir","Arjun","Rohan","Harsh","Yash","Kartik","Dev","Ayush","Om","Shreyas","Lakshya","Nitin","Rudra","Tejas","Vedant"].includes(f) ? "M" : "F",
    dob: `${2010 + (i % 4)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
    guardian: `${["Rakesh","Sanjay","Vinod","Manoj","Alok","Dinesh","Pramod","Ashok"][i % 8]} ${last}`,
    guardianEmail: "", phone: `90000 ${String(10001 + i)}`, address: `${AREAS[i % AREAS.length]}, Rewa`, status: "active",
  };
});
// Two sibling pairs share one guardian (one email = one login, two children).
for (const [a, b] of [[1, 8], [3, 10]] as const) {
  STUDENTS[b].guardian = STUDENTS[a].guardian; STUDENTS[b].phone = STUDENTS[a].phone; STUDENTS[b].address = STUDENTS[a].address;
  STUDENTS[b].name = `${STUDENTS[b].name.split(" ")[0]} ${STUDENTS[a].name.split(" ")[1]}`;
}
STUDENTS.forEach((st, i) => {
  st.guardianEmail = `${st.guardian.toLowerCase().replace(" ", ".")}${[8, 10].includes(i) ? "" : i}@example.in`;
});
STUDENTS[8].guardianEmail = STUDENTS[1].guardianEmail; STUDENTS[10].guardianEmail = STUDENTS[3].guardianEmail;
// One student who already left, to show the lifecycle.
Object.assign(STUDENTS[35], { status: "left", leftOn: "2026-09-15", leavingReason: "Family moved to Bhopal", tcNumber: "TC-2026-014" });

/* ---------- Admissions ---------- */
export type AdmissionStatus = "enquiry" | "applied" | "approved" | "rejected" | "enrolled";
export const ADMISSIONS: { id: string; applicant: string; gradeApplied: string; guardian: string; phone: string; status: AdmissionStatus; appliedAt: string }[] = [
  { id: "a1", applicant: "Aryan Soni", gradeApplied: "6", guardian: "Mahesh Soni", phone: "90000 30001", status: "applied", appliedAt: "2026-10-30T05:10:00Z" },
  { id: "a2", applicant: "Bhavya Tiwari", gradeApplied: "8", guardian: "Sandeep Tiwari", phone: "90000 30002", status: "approved", appliedAt: "2026-10-28T09:40:00Z" },
  { id: "a3", applicant: "Chirag Pathak", gradeApplied: "9", guardian: "Lalit Pathak", phone: "90000 30003", status: "enquiry", appliedAt: "2026-10-31T11:20:00Z" },
  { id: "a4", applicant: "Divya Kushwaha", gradeApplied: "7", guardian: "Ramesh Kushwaha", phone: "90000 30004", status: "applied", appliedAt: "2026-10-29T04:05:00Z" },
  { id: "a5", applicant: "Eshan Baghel", gradeApplied: "10", guardian: "Surendra Baghel", phone: "90000 30005", status: "enrolled", appliedAt: "2026-10-20T06:30:00Z" },
  { id: "a6", applicant: "Fiza Khan", gradeApplied: "6", guardian: "Imran Khan", phone: "90000 30006", status: "rejected", appliedAt: "2026-10-18T07:45:00Z" },
];

/* ---------- Fees (offline collection) ---------- */
export type FeeMode = "cash" | "cheque" | "upi" | "bank_transfer";
/** One line on an invoice. Negative amounts are discounts and concessions. */
export interface InvoiceItem { id: string; label: string; amountPaise: number; kind: "fee" | "discount" | "late_fee" | "carried_forward"; }
/** One instalment. A wrong entry is cancelled, never deleted. */
export interface FeePayment { id: string; receiptNo: string; amountPaise: number; mode: FeeMode; reference?: string; at: string; receivedBy: string; status: "active" | "cancelled"; cancelReason?: string; cancelledAt?: string; }
export interface Invoice {
  id: string; no: string; studentId: string; period: string; dueOn: string;
  items: InvoiceItem[]; payments: FeePayment[];
  /** Derived by settle(): total = sum of items, paid = sum of active payments. Kept so older screens keep working. */
  totalPaise: number; paidPaise: number; lastPaymentAt?: string; mode?: FeeMode;
}
/** Recompute the derived fields after items or payments change. Call this after every edit. */
export function settle(inv: Invoice): Invoice {
  inv.totalPaise = inv.items.reduce((a, i) => a + i.amountPaise, 0);
  const active = inv.payments.filter((p) => p.status === "active").sort((a, b) => a.at.localeCompare(b.at));
  inv.paidPaise = active.reduce((a, p) => a + p.amountPaise, 0);
  inv.lastPaymentAt = active.at(-1)?.at;
  inv.mode = active.at(-1)?.mode;
  return inv;
}
const gradeFee = (g: string) => 1_200_000 + Number(g) * 100_000; // Rs 12,000 + Rs 1,000 per grade, in paise
export const INVOICES: Invoice[] = STUDENTS.map((s, i) => {
  const total = gradeFee(CLASSES.find((c) => c.id === s.classId)!.grade);
  const tuition = Math.round(total * 0.75), activity = total - tuition;
  const paid = i % 3 === 0 ? total : i % 3 === 1 ? Math.round(total / 2) : 0;
  const modes: FeeMode[] = ["cash", "upi", "cheque"];
  const at = (n: number) => `2026-10-${String(10 + ((i + n) % 15)).padStart(2, "0")}T0${4 + ((i + n) % 5)}:30:00Z`;
  const payments: FeePayment[] = paid === total && i % 6 === 0
    ? [{ id: `p${i}a`, receiptNo: `RCP-${3001 + i}`, amountPaise: Math.round(total / 2), mode: modes[i % 3], at: at(0), receivedBy: "Suresh Tiwari", status: "active" },
       { id: `p${i}b`, receiptNo: `RCP-${3001 + i}B`, amountPaise: total - Math.round(total / 2), mode: "upi", reference: "UPI 4482", at: at(5), receivedBy: "Suresh Tiwari", status: "active" }]
    : paid
      ? [{ id: `p${i}a`, receiptNo: `RCP-${3001 + i}`, amountPaise: paid, mode: modes[i % 3], at: at(0), receivedBy: "Suresh Tiwari", status: "active" }]
      : [];
  return settle({
    id: `inv${i + 1}`, no: `INV-${3001 + i}`, studentId: s.id, period: "Term 2", dueOn: "2026-11-10",
    items: [{ id: `i${i}a`, label: "Tuition fee", amountPaise: tuition, kind: "fee" }, { id: `i${i}b`, label: "Activity and lab fee", amountPaise: activity, kind: "fee" }],
    payments, totalPaise: 0, paidPaise: 0,
  });
});
export const invoiceStatus = (inv: Invoice) => (inv.paidPaise >= inv.totalPaise ? "paid" : inv.paidPaise > 0 ? "partial" : "unpaid");

/* ---------- Library ---------- */
export const BOOKS = [
  { id: "b1", title: "Wings of Fire", author: "A. P. J. Abdul Kalam", category: "Biography", copies: 4, issued: 2 },
  { id: "b2", title: "Malgudi Days", author: "R. K. Narayan", category: "Fiction", copies: 3, issued: 1 },
  { id: "b3", title: "Discovery of India", author: "Jawaharlal Nehru", category: "History", copies: 2, issued: 2 },
  { id: "b4", title: "Panchatantra", author: "Vishnu Sharma", category: "Stories", copies: 5, issued: 0 },
  { id: "b5", title: "A Brief History of Time", author: "Stephen Hawking", category: "Science", copies: 2, issued: 1 },
  { id: "b6", title: "Godaan", author: "Premchand", category: "Hindi Literature", copies: 3, issued: 1 },
];
export const LOANS = [
  { id: "l1", book: "Wings of Fire", borrower: "Aarav Tiwari", kind: "Student", issuedAt: "2026-10-22T04:40:00Z", dueOn: "2026-11-05" },
  { id: "l2", book: "Discovery of India", borrower: "Ananya Mishra", kind: "Student", issuedAt: "2026-10-15T05:00:00Z", dueOn: "2026-10-29" },
  { id: "l3", book: "Godaan", borrower: "Pooja Singh", kind: "Staff", issuedAt: "2026-10-25T06:15:00Z", dueOn: "2026-11-08" },
  { id: "l4", book: "Malgudi Days", borrower: "Diya Pandey", kind: "Student", issuedAt: "2026-10-26T04:10:00Z", dueOn: "2026-11-09" },
];

/* ---------- Academic ---------- */
export const HOLIDAYS = [
  { id: "h1", title: "Diwali Break", fromOn: "2026-11-08", toOn: "2026-11-12", kind: "holiday" },
  { id: "h2", title: "Half-yearly Exams", fromOn: "2026-11-23", toOn: "2026-12-04", kind: "exam" },
  { id: "h3", title: "Annual Sports Day", fromOn: "2026-12-12", toOn: "2026-12-12", kind: "event" },
  { id: "h4", title: "Winter Break", fromOn: "2026-12-25", toOn: "2027-01-03", kind: "holiday" },
];
export const NOTICES = [
  { id: "n1", title: "Diwali holidays announced", body: "School will remain closed from 8 to 12 November. Classes resume on 13 November.", audience: "all", publishedAt: "2026-10-30T05:00:00Z" },
  { id: "n2", title: "Half-yearly exam timetable", body: "The timetable has been shared with class teachers. Parents will receive it in the app.", audience: "parents", publishedAt: "2026-10-28T08:30:00Z" },
  { id: "n3", title: "Staff meeting on Monday", body: "All staff to assemble in the conference room at 1:00 pm.", audience: "staff", publishedAt: "2026-10-31T10:00:00Z" },
];
export const EXAMS = [{ id: "e1", name: "Unit Test 2" }, { id: "e2", name: "Half-yearly" }];
export const SUBJECTS = ["Mathematics", "English", "Hindi", "Science", "Social Science"];

/* ---------- Messages ---------- */
export const THREADS = [
  { id: "t3", classId: "c8b", studentId: "st4", title: "Sanjay Tiwari · parent of Diya", last: "Thank you, sir. We will meet on Saturday.", lastAt: "2026-10-29T12:45:00Z" },
  { id: "t5", classId: "c8b", studentId: "st10", title: "Alok Singh · parent of Saanvi", last: "Sure, I will check her notebook today.", lastAt: "2026-10-27T10:15:00Z" },
  { id: "t6", classId: "c6a", studentId: "st1", title: "Rakesh Tiwari · parent of Aarav", last: "Aarav will join the sports practice.", lastAt: "2026-10-30T07:40:00Z" },
];
export const MESSAGES: Record<string, { id: string; mine: boolean; from: string; body: string; at: string; file?: string }[]> = {
  t3: [
    { id: "m5", mine: true, from: "You", body: "Diya has missed two tests. Could we meet this week?", at: "2026-10-29T12:30:00Z" },
    { id: "m6", mine: false, from: "Sanjay Tiwari", body: "Thank you, sir. We will meet on Saturday.", at: "2026-10-29T12:45:00Z" },
  ],
  t5: [
    { id: "m8", mine: true, from: "You", body: "Her handwriting has improved a lot this month.", at: "2026-10-27T10:05:00Z" },
    { id: "m9", mine: false, from: "Alok Singh", body: "Sure, I will check her notebook today.", at: "2026-10-27T10:15:00Z" },
  ],
  t6: [
    { id: "m10", mine: true, from: "You", body: "Sports practice starts on Monday at 7:30 am.", at: "2026-10-30T07:30:00Z" },
    { id: "m11", mine: false, from: "Rakesh Tiwari", body: "Aarav will join the sports practice.", at: "2026-10-30T07:40:00Z" },
  ],
};

/* ---------- Student history (student_events) ---------- */
export type EventKind = "admitted" | "promoted" | "detained" | "class_changed" | "left" | "tc_issued" | "rejoined" | "passed_out";
export interface StudentEvent { id: string; studentId: string; kind: EventKind; on: string; detail: string; by: string; }
export function eventsFor(s: Student): StudentEvent[] {
  const ev: StudentEvent[] = [
    { id: `${s.id}-e1`, studentId: s.id, kind: "admitted", on: "2024-04-08", detail: `Admitted to class ${Number(className(s.classId).split("-")[0]) - 2}`, by: "Meera Rao" },
    { id: `${s.id}-e2`, studentId: s.id, kind: "promoted", on: "2025-04-07", detail: `Promoted to class ${Number(className(s.classId).split("-")[0]) - 1}`, by: "Anil Shukla" },
    { id: `${s.id}-e3`, studentId: s.id, kind: "promoted", on: "2026-04-06", detail: `Promoted to class ${className(s.classId).split("-")[0]}`, by: "Anil Shukla" },
  ];
  if (s.status !== "active") {
    ev.push({ id: `${s.id}-e4`, studentId: s.id, kind: "left", on: s.leftOn!, detail: s.leavingReason ?? "", by: "Anil Shukla" });
    if (s.tcNumber) ev.push({ id: `${s.id}-e5`, studentId: s.id, kind: "tc_issued", on: s.leftOn!, detail: `Transfer certificate ${s.tcNumber}`, by: "Meera Rao" });
  }
  return ev;
}

/* ---------- Attendance stats (computed from half-day records in the real system) ---------- */
export function attendanceStats(studentId: string) {
  const n = Number(studentId.replace("st", ""));
  const workingDays = 26;
  const absent = (n * 7) % 5, half = (n * 3) % 4;
  const value = workingDays - absent - half * 0.5;
  return { workingDays, absent, half, present: workingDays - absent - half, pct: Math.round((value / workingDays) * 1000) / 10 };
}

/* ---------- Broadcasts ---------- */
export interface Broadcast { id: string; classId: string; subject: string; sender: string; body: string; sentAt: string; file?: string; }
export const BROADCASTS: Broadcast[] = [
  { id: "bc1", classId: "c8b", subject: "Mathematics", sender: "Rajiv Mishra", body: "Chapter 7 practice sheet attached. Please revise before Friday's test.", sentAt: "2026-10-31T09:20:00Z", file: "Math-Practice-Sheet.pdf" },
  { id: "bc2", classId: "c8b", subject: "English", sender: "Sunita Dwivedi", body: "Book review is due on Monday. Two pages is enough.", sentAt: "2026-10-30T06:10:00Z" },
  { id: "bc3", classId: "c9a", subject: "Science", sender: "Farhan Khan", body: "Project guidelines attached. Groups of three.", sentAt: "2026-10-28T06:30:00Z", file: "Science-Project.pdf" },
  { id: "bc4", classId: "c6a", subject: "General", sender: "Sunita Dwivedi", body: "PTM slots are open for booking this week.", sentAt: "2026-10-30T07:05:00Z" },
];

/* ---------- Parent logins ---------- */
export type InviteStatus = "not_sent" | "sent" | "active";
export interface ParentAccount { email: string; guardian: string; phone: string; children: Student[]; status: InviteStatus; lastSentAt?: string; sendCount: number; }
export const PARENT_ACCOUNTS: ParentAccount[] = (() => {
  const by = new Map<string, ParentAccount>();
  STUDENTS.forEach((s, i) => {
    const a = by.get(s.guardianEmail) ?? { email: s.guardianEmail, guardian: s.guardian, phone: s.phone, children: [], status: "not_sent" as InviteStatus, sendCount: 0 };
    a.children.push(s);
    if (a.children.length === 1) {
      a.status = i % 3 === 0 ? "active" : i % 3 === 1 ? "sent" : "not_sent";
      if (a.status !== "not_sent") { a.lastSentAt = `2026-10-${String(12 + (i % 15)).padStart(2, "0")}T05:30:00Z`; a.sendCount = 1; }
    }
    by.set(s.guardianEmail, a);
  });
  return [...by.values()];
})();

/* ---------- Promotion ---------- */
export const NEXT_YEAR = "2027–28";

/* ---------- Sign-in accounts (demo). One login for everyone, routed by `kind`. ---------- */
export interface Account { email: string; password: string; kind: "owner" | "staff" | "parent"; staffId?: string; parentEmail?: string; mustChangePassword?: boolean; }
export const ACCOUNTS: Account[] = [
  { email: "owner@scool.in", password: "Scool@123", kind: "owner" },
  { email: "principal@demo.in", password: "Scool@123", kind: "staff", staffId: "s1" },
  { email: "accounts@demo.in", password: "Scool@123", kind: "staff", staffId: "s2" },
  { email: "vp@demo.in", password: "Scool@123", kind: "staff", staffId: "s4" },
  { email: "teacher@demo.in", password: "Scool@123", kind: "staff", staffId: "s5" },
  { email: "new.teacher@demo.in", password: "Temp@1234", kind: "staff", staffId: "s8", mustChangePassword: true },
  { email: "parent@demo.in", password: "Scool@123", kind: "parent", parentEmail: "DEMO" },
];

/** The demo parent has two children (siblings), so the child switcher can be seen. */
export const DEMO_PARENT_EMAIL = PARENT_ACCOUNTS.find((p) => p.children.length > 1)!.email;
