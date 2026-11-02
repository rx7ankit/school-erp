package tech.slov.app.domain

import java.time.LocalDate

enum class AttendanceStatus { PRESENT, ABSENT, HALF_FIRST, HALF_SECOND, LEAVE, HOLIDAY, NOT_MARKED }

data class TodayAttendance(
    val status: AttendanceStatus,
    /** UTC ISO-8601 string, null when not marked. */
    val markedAt: String?,
)

data class AttendanceDay(val date: LocalDate, val status: AttendanceStatus)

/** One calendar month for one child. [month] is "yyyy-MM". */
data class AttendanceMonth(val month: String, val days: List<AttendanceDay>) {
    private fun count(vararg s: AttendanceStatus) = days.count { it.status in s }

    val presentDays: Int get() = count(AttendanceStatus.PRESENT)
    val absentDays: Int get() = count(AttendanceStatus.ABSENT)
    val halfDays: Int get() = count(AttendanceStatus.HALF_FIRST, AttendanceStatus.HALF_SECOND)
    val leaveDays: Int get() = count(AttendanceStatus.LEAVE)

    /**
     * Attendance percentage. A half-day counts 0.5. Leave counts as a school day not attended.
     * Holidays and unmarked days are excluded. Null when there is nothing to measure.
     */
    val percent: Double?
        get() {
            val counted = presentDays + absentDays + halfDays + leaveDays
            if (counted == 0) return null
            return (presentDays + halfDays * 0.5) * 100.0 / counted
        }
}
