package tech.krevo.app.domain

import java.time.LocalDate

/** Matches the switches in Settings > Notifications and the Android channels. */
enum class NotificationCategory { ATTENDANCE, FEES, NOTICES_EXAMS, RESULTS, MESSAGES }

enum class NotificationType(val category: NotificationCategory) {
    ATTENDANCE_PRESENT(NotificationCategory.ATTENDANCE),
    ATTENDANCE_ABSENT(NotificationCategory.ATTENDANCE),
    ATTENDANCE_FIRST_HALF(NotificationCategory.ATTENDANCE),
    ATTENDANCE_SECOND_HALF(NotificationCategory.ATTENDANCE),
    LEAVE_APPROVED(NotificationCategory.ATTENDANCE),
    LEAVE_REJECTED(NotificationCategory.ATTENDANCE),
    REPORT_CARD(NotificationCategory.RESULTS),
    BROADCAST(NotificationCategory.MESSAGES),
    MESSAGE(NotificationCategory.MESSAGES),
    PROMOTION_PROMOTED(NotificationCategory.RESULTS),
    PROMOTION_STAYED(NotificationCategory.RESULTS),
    PROMOTION_COMPLETED(NotificationCategory.RESULTS),
    FEE_REMINDER(NotificationCategory.FEES),
    NOTICE(NotificationCategory.NOTICES_EXAMS),
    EXAM_DATE_SHEET(NotificationCategory.NOTICES_EXAMS),
    RESULT_PUBLISHED(NotificationCategory.RESULTS),
    FEEDBACK_REQUESTED(NotificationCategory.NOTICES_EXAMS),
}

/**
 * One entry in the notification centre. The text is built on the device from [type] and the fields below,
 * so it follows the app language. [deepLink] is a navigation route (same value the push payload carries).
 */
data class AppNotification(
    val id: String,
    val type: NotificationType,
    val childId: String,
    val childName: String,
    /** UTC ISO-8601 string. */
    val at: String,
    val read: Boolean,
    val deepLink: String,
    /** Fee reminder only. */
    val amountPaise: Long? = null,
    val dueOn: LocalDate? = null,
    /** Notice title, exam name or result name, as the school wrote it. */
    val subject: String? = null,
    /** Broadcast or message sender (teacher). Null for a school-level broadcast. */
    val sender: String? = null,
    /** First line of the broadcast or message. */
    val preview: String? = null,
    /** Promotion only: the new class (or the class completed) and the academic year. */
    val className: String? = null,
    val year: String? = null,
    /** Text written by the server (already in the parent's language). When set it wins over the text built from [type]. */
    val serverTitle: String? = null,
    val serverBody: String? = null,
)

const val PROMOTION_CARD_DAYS = 14L

/**
 * The promotion that should show as a Home congratulations card for [childId]: promoted or completed
 * (never "stayed"), at most 14 IST days old, and not dismissed. [dismissed] holds notification ids.
 */
fun List<AppNotification>.promotionCard(childId: String, dismissed: Set<String>): AppNotification? =
    filter {
        it.childId == childId &&
            (it.type == NotificationType.PROMOTION_PROMOTED || it.type == NotificationType.PROMOTION_COMPLETED) &&
            it.id !in dismissed && Ist.daysSince(it.at) in 0..PROMOTION_CARD_DAYS
    }.maxByOrNull { it.at }
