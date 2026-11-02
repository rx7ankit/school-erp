import { jsPDF } from "jspdf";
import { SCHOOL, STUDENTS } from "./mock";
import { currentYear, getAcademic, classLabel, examSubjectsFor, gradeFor, markOf, remarkOf, subjectName } from "./academic-setup";
import { markFor, monthDays } from "./parent-data";
import { formatDateOn, formatIST, nowUTC, todayOnIST } from "./time";

export interface ReportSubject { name: string; max: number; pass: number; marks: number | null; grade: string; }
export interface ReportCardData {
  school: string; city: string;
  student: { name: string; className: string; scholarNo: string; rollNo: number | null; dob: string };
  exam: { name: string; term: string; fromOn: string; toOn: string };
  year: string;
  subjects: ReportSubject[];
  total: number; maxTotal: number; pct: number; grade: string; passed: boolean | null;
  /** null when the source (the API) has no attendance for this student */
  attendance: { pct: number; fromOn: string; toOn: string; working: number } | null;
  remark: string;
  issuedAt: string;
}

/** Attendance % from the start of the academic year to the end of the exam (or today). Half day counts 0.5. */
function attendanceFor(studentId: string, fromOn: string, toOn: string) {
  const todayOn = todayOnIST();
  const end = toOn < todayOn ? toOn : todayOn;
  let present = 0, working = 0;
  for (let ym = fromOn.slice(0, 7); ym <= end.slice(0, 7); ym = nextMonth(ym)) {
    for (const d of monthDays(ym)) {
      if (d < fromOn || d > end) continue;
      const m = markFor(studentId, d, todayOn);
      if (m === "present") { present += 1; working += 1; }
      else if (m === "half") { present += 0.5; working += 1; }
      else if (m === "absent" || m === "leave") working += 1;
    }
  }
  return { pct: working ? Math.round((present / working) * 1000) / 10 : 0, fromOn, toOn: end, working };
}
const nextMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

/** Everything a report card shows. Used by the staff results page and the parent app. Null when the exam or student is unknown. */
export function buildReportCardData(studentId: string, examId: string): ReportCardData | null {
  const st = STUDENTS.find((s) => s.id === studentId);
  const ex = getAcademic().exams.find((e) => e.id === examId);
  if (!st || !ex) return null;
  const scheme = getAcademic().scheme;
  const subjects: ReportSubject[] = examSubjectsFor(examId, st.classId).map((es) => {
    const marks = markOf(examId, es.subjectId, st.id) ?? null;
    return { name: subjectName(es.subjectId), max: es.max, pass: es.pass, marks, grade: marks === null ? "—" : gradeFor((marks / es.max) * 100, scheme) };
  });
  const entered = subjects.filter((s) => s.marks !== null);
  const total = entered.reduce((a, s) => a + (s.marks ?? 0), 0);
  const maxTotal = entered.reduce((a, s) => a + s.max, 0);
  const pct = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
  const passed = entered.length > 0 && pct >= scheme.passPercent && entered.every((s) => (s.marks ?? 0) >= s.pass);
  const yr = currentYear();
  return {
    school: SCHOOL.name, city: SCHOOL.city,
    student: { name: st.name, className: classLabel(st.classId), scholarNo: st.scholarNo, rollNo: st.rollNo, dob: st.dob },
    exam: { name: ex.name, term: ex.term, fromOn: ex.fromOn, toOn: ex.toOn },
    year: yr.label, subjects, total, maxTotal, pct, grade: gradeFor(pct, scheme), passed,
    attendance: attendanceFor(st.id, yr.fromOn, ex.toOn), remark: remarkOf(examId, st.id), issuedAt: nowUTC(),
  };
}

const ACCENT: [number, number, number] = [255, 106, 0];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A4 report card, drawn directly with built-in Helvetica. Never stored. */
export function downloadReportCard(d: ReportCardData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18, R = W - M;
  const grey = (n: number) => doc.setTextColor(n, n, n);

  // Header
  doc.setFont("helvetica", "bold").setFontSize(20); grey(20); doc.text(d.school, M, 24);
  doc.setFont("helvetica", "normal").setFontSize(10); grey(110); doc.text(d.city, M, 30);
  doc.setFont("helvetica", "bold").setFontSize(12); grey(20); doc.text("REPORT CARD", R, 24, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(10); grey(110);
  doc.text(d.exam.name, R, 30, { align: "right" }); doc.text([d.exam.term, `Academic year ${d.year}`].filter(Boolean).join(" · "), R, 35, { align: "right" });
  doc.setDrawColor(...ACCENT).setLineWidth(0.8).line(M, 40, R, 40);

  // Student block
  const info = ([["Student", d.student.name], ["Class", d.student.className], ["Scholar no.", d.student.scholarNo], ["Roll no.", d.student.rollNo === null ? "" : String(d.student.rollNo)], ["Date of birth", d.student.dob ? formatDateOn(d.student.dob) : ""], ["Exam period", d.exam.fromOn && d.exam.toOn ? `${formatDateOn(d.exam.fromOn, "short")} to ${formatDateOn(d.exam.toOn)}` : ""]] as [string, string][]).filter(([, v]) => v);
  info.forEach(([k, v], i) => {
    const x = i % 2 === 0 ? M : 112, y = 52 + Math.floor(i / 2) * 9;
    doc.setFont("helvetica", "normal").setFontSize(9); grey(120); doc.text(k, x, y);
    doc.setFont("helvetica", "bold").setFontSize(10.5); grey(20); doc.text(v, x + 28, y);
  });

  // Subject table
  let y = 84;
  doc.setFillColor(243, 243, 245).roundedRect(M, y, R - M, 9, 2, 2, "F");
  const cols = { subject: M + 4, max: 118, marks: 142, grade: R - 4 };
  doc.setFont("helvetica", "bold").setFontSize(9); grey(90);
  doc.text("SUBJECT", cols.subject, y + 6); doc.text("MAX", cols.max, y + 6, { align: "right" }); doc.text("MARKS", cols.marks, y + 6, { align: "right" }); doc.text("GRADE", cols.grade, y + 6, { align: "right" });
  y += 9;
  d.subjects.forEach((s) => {
    y += 9;
    doc.setFont("helvetica", "normal").setFontSize(10.5); grey(20); doc.text(s.name, cols.subject, y);
    grey(110); doc.text(String(s.max), cols.max, y, { align: "right" });
    doc.setFont("helvetica", "bold"); grey(s.marks !== null && s.marks < s.pass ? 150 : 20); doc.text(s.marks === null ? "-" : String(s.marks), cols.marks, y, { align: "right" });
    grey(20); doc.text(s.grade === "—" ? "-" : s.grade, cols.grade, y, { align: "right" });
    doc.setDrawColor(225).setLineWidth(0.2).line(M, y + 3.5, R, y + 3.5);
  });
  y += 10;
  doc.setFont("helvetica", "bold").setFontSize(11); grey(20);
  doc.text("Total", cols.subject, y); doc.text(String(d.maxTotal), cols.max, y, { align: "right" }); doc.text(String(d.total), cols.marks, y, { align: "right" }); doc.text(d.grade, cols.grade, y, { align: "right" });

  // Summary
  y += 12;
  doc.setFillColor(243, 243, 245).roundedRect(M, y, R - M, 24, 3, 3, "F");
  const cell = (x: number, label: string, value: string) => { doc.setFont("helvetica", "normal").setFontSize(8.5); grey(120); doc.text(label.toUpperCase(), x, y + 8); doc.setFont("helvetica", "bold").setFontSize(15); grey(20); doc.text(value, x, y + 18); };
  cell(M + 6, "Percentage", `${d.pct}%`); cell(M + 50, "Overall grade", d.grade); if (d.attendance) cell(M + 94, "Attendance", `${d.attendance.pct}%`);
  doc.setFont("helvetica", "bold").setFontSize(12); grey(d.passed ? 20 : 90); doc.text(d.passed === null ? "INCOMPLETE" : d.passed ? "PASS" : "NEEDS SUPPORT", R - 6, y + 15, { align: "right" });
  y += 30;
  doc.setFont("helvetica", "normal").setFontSize(8.5); grey(130);
  if (d.attendance) doc.text(`Attendance ${formatDateOn(d.attendance.fromOn, "short")} to ${formatDateOn(d.attendance.toOn)}, ${d.attendance.working} working days, half day counts 0.5.`, M, y);

  // Remark
  y += 12;
  doc.setFont("helvetica", "bold").setFontSize(9); grey(120); doc.text("CLASS TEACHER REMARK", M, y);
  doc.setFont("helvetica", "normal").setFontSize(10.5); grey(30);
  doc.text(doc.splitTextToSize(d.remark || "No remark added.", R - M), M, y + 7);

  // Signatures and issue line
  const sy = 258;
  doc.setDrawColor(120).setLineWidth(0.3).line(M, sy, M + 55, sy).line(R - 55, sy, R, sy);
  doc.setFont("helvetica", "normal").setFontSize(9); grey(110);
  doc.text("Class teacher", M, sy + 5); doc.text("Principal", R - 55, sy + 5);
  doc.setFontSize(8); grey(140);
  doc.text(`Issued ${formatIST(d.issuedAt)} IST. Computer generated from published results.`, M, 282);
  doc.save(`report-card-${slug(d.student.name)}-${slug(d.exam.name)}.pdf`);
}
