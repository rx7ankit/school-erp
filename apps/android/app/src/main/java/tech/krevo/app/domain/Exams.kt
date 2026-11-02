package tech.krevo.app.domain

import java.time.LocalDate

/** One paper of a date sheet. [startsAt] is a UTC ISO-8601 string, shown in IST. */
data class ExamPaper(val subject: String, val startsAt: String)

/** An upcoming exam with its per-subject date sheet, for one class. */
data class ExamSchedule(
    val id: String,
    val name: String,
    val fromOn: LocalDate,
    val toOn: LocalDate,
    val papers: List<ExamPaper>,
)
