package `in`.krevo.app.domain

import java.time.LocalDate

const val FEEDBACK_MAX_STARS = 5
const val FEEDBACK_COMMENT_MAX = 500

/** A teacher the parent can rate. */
data class FeedbackTarget(
    val id: String,
    val teacher: String,
    val subject: String,
    val isClassTeacher: Boolean,
)

/** One rating sent by the parent. [rating] is 1..5, [comment] is optional (max 500 chars). */
data class FeedbackRating(
    val targetId: String,
    val rating: Int,
    val comment: String? = null,
)

data class FeedbackRequest(
    val id: String,
    val title: String,
    /** Last school date to answer (date-only, never zone-shifted). */
    val closesOn: LocalDate,
    val targets: List<FeedbackTarget>,
    /** Ratings already sent for this child. Empty while the request is still pending. */
    val submitted: List<FeedbackRating>,
) {
    val answered: Boolean get() = submitted.isNotEmpty()
    val pending: Boolean get() = !answered
}
