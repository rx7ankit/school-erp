package `in`.krevo.app.domain

import java.time.LocalDate

const val LEAVE_REASON_MAX = 200

/** NONE = whole day(s). FIRST / SECOND are only allowed for a single-day request. */
enum class LeaveHalf { NONE, FIRST, SECOND }

enum class LeaveStatus { PENDING, APPROVED, REJECTED, CANCELLED }

data class LeaveRequest(
    val id: String,
    /** School calendar dates (IST), never zone-shifted. */
    val fromOn: LocalDate,
    val toOn: LocalDate,
    val half: LeaveHalf,
    val reason: String,
    val status: LeaveStatus,
    /** The teacher's note on an approved or rejected request. */
    val decisionNote: String? = null,
    /** UTC ISO-8601 string. */
    val createdAt: String,
)
