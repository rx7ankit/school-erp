package tech.krevo.app.domain

/** The academic year the app is showing now; older exams are listed under "Past years". */
const val CURRENT_ACADEMIC_YEAR = "2026-27"

data class ExamSummary(
    val id: String,
    val name: String,
    val percentage: Double,
    /** UTC ISO-8601 string. */
    val publishedAt: String,
    /** e.g. "2025-26". */
    val academicYear: String = CURRENT_ACADEMIC_YEAR,
) {
    val isPastYear: Boolean get() = academicYear != CURRENT_ACADEMIC_YEAR
}

data class SubjectMark(val subject: String, val marks: Int, val max: Int) {
    val grade: String get() = gradeFor(marks * 100.0 / max)
}

data class ExamDetail(
    val id: String,
    val name: String,
    val subjects: List<SubjectMark>,
    val remark: String,
    /** UTC ISO-8601 string. */
    val publishedAt: String,
    /** Attendance % over [attendanceFrom]..[attendanceTo] (half day = 0.5), null when nothing was marked. */
    val attendancePercent: Double? = null,
    val attendanceFrom: java.time.LocalDate? = null,
    val attendanceTo: java.time.LocalDate? = null,
) {
    val total: Int get() = subjects.sumOf { it.marks }
    val maxTotal: Int get() = subjects.sumOf { it.max }
    val percentage: Double get() = if (maxTotal == 0) 0.0 else total * 100.0 / maxTotal
    val grade: String get() = gradeFor(percentage)
}

fun gradeFor(percent: Double): String = when {
    percent >= 90 -> "A+"
    percent >= 80 -> "A"
    percent >= 70 -> "B+"
    percent >= 60 -> "B"
    percent >= 50 -> "C"
    percent >= 33 -> "D"
    else -> "E"
}
