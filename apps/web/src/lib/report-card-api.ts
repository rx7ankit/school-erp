import type { ApiReportCard } from "@/lib/api/hooks/results";
import type { ReportCardData } from "@/lib/report-card";

/** The API's report card as the data the existing PDF drawing code takes. Nothing is invented: what the API does not send stays empty. */
export function reportCardFromApi(r: ApiReportCard): ReportCardData {
  const a = r.attendance as { percentage?: number | null; working_days?: number; from_on?: string; to_on?: string } | null;
  const marks = new Map(r.marks.map((m) => [m.subject_id, m]));
  return {
    school: r.school_name, city: "",
    student: { name: r.name, className: r.class_name, scholarNo: r.scholar_no, rollNo: r.roll_no, dob: "" },
    exam: { name: r.exam.name, term: "", fromOn: r.exam.starts_on ?? "", toOn: r.exam.ends_on ?? "" },
    year: r.academic_year,
    subjects: r.papers.map((p) => {
      const m = marks.get(p.subject_id);
      return { name: p.subject, max: p.max_marks, pass: p.pass_marks, marks: m?.entered && !m.absent ? m.marks_obtained : null, grade: m?.absent ? "Abs" : m?.grade ?? "—" };
    }),
    total: r.total, maxTotal: r.max_total, pct: r.percentage ?? 0, grade: r.grade ?? "—", passed: r.passed,
    attendance: a && a.percentage != null && a.from_on && a.to_on ? { pct: a.percentage, fromOn: a.from_on, toOn: a.to_on, working: a.working_days ?? 0 } : null,
    remark: r.remark ?? "", issuedAt: r.generated_at,
  };
}
