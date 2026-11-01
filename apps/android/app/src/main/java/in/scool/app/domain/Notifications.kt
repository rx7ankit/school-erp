package `in`.scool.app.domain

import java.time.LocalDate

/** Matches the switches in Settings > Notifications and the Android channels. */
enum class NotificationCategory { ATTENDANCE, FEES, NOTICES_EXAMS, RESULTS, MESSAGES }

enum class NotificationType(val category: NotificationCategory) {
    ATTENDANCE_PRESENT(NotificationCategory.ATTENDANCE),
    ATTENDANCE_ABSENT(NotificationCategory.ATTENDANCE),
    ATTENDANCE_FIRST_HALF(NotificationCategory.ATTENDANCE),
    ATTENDANCE_SECOND_HALF(NotificationCategory.ATTENDANCE),
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
)
