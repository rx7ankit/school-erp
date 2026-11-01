package `in`.scool.app.domain

data class ExamSummary(
    val id: String,
    val name: String,
    val percentage: Double,
    /** UTC ISO-8601 string. */
    val publishedAt: String,
)

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
