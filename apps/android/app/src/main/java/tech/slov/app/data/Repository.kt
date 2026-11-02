package tech.slov.app.data

import tech.slov.app.domain.AppNotification
import tech.slov.app.domain.AttendanceMonth
import tech.slov.app.domain.CalendarEvent
import tech.slov.app.domain.Child
import tech.slov.app.domain.ExamDetail
import tech.slov.app.domain.ExamSchedule
import tech.slov.app.domain.ExamSummary
import tech.slov.app.domain.FeedbackRating
import tech.slov.app.domain.FeedbackRequest
import tech.slov.app.domain.Invoice
import tech.slov.app.domain.TeacherThread
import tech.slov.app.domain.ThreadMessage
import tech.slov.app.domain.Update
import tech.slov.app.domain.LeaveHalf
import tech.slov.app.domain.LeaveRequest
import tech.slov.app.domain.Timetable
import java.time.LocalDate
import tech.slov.app.domain.Notice
import tech.slov.app.domain.TodayAttendance
import tech.slov.app.domain.User

/**
 * Everything the app reads or writes. Parents are read-only except messaging and changing password.
 * Implementations throw an exception with a user-readable message on failure.
 */
interface Repository {
    suspend fun login(email: String, password: String): User
    suspend fun changePassword(newPassword: String)
    suspend fun children(): List<Child>
    suspend fun today(childId: String): TodayAttendance
    /** [month] is "yyyy-MM". */
    suspend fun attendanceMonth(childId: String, month: String): AttendanceMonth
    suspend fun exams(childId: String): List<ExamSummary>
    suspend fun examDetail(id: String): ExamDetail
    /** The Updates feed: school broadcasts and class broadcasts for the child, newest first. */
    suspend fun updates(childId: String): List<Update>
    suspend fun markUpdatesRead(childId: String)
    /** One thread per teacher of the child: active teachers first (class teacher first), then previous teachers. */
    suspend fun teacherThreads(childId: String): List<TeacherThread>
    /** Oldest first. Opening a thread marks it read. */
    suspend fun threadMessages(threadId: String): List<ThreadMessage>
    /** Rejected with a typed error for an inactive thread or a child who has left school. */
    suspend fun sendMessage(threadId: String, text: String): ThreadMessage
    suspend fun invoices(childId: String): List<Invoice>
    suspend fun notices(): List<Notice>
    suspend fun calendar(): List<CalendarEvent>
    /** The child's leave requests, newest first. */
    suspend fun leaveRequests(childId: String): List<LeaveRequest>
    suspend fun applyLeave(childId: String, from: LocalDate, to: LocalDate, half: LeaveHalf, reason: String): LeaveRequest
    /** Only a pending request can be cancelled. */
    suspend fun cancelLeave(id: String)
    /** Class timetable (Monday to Saturday) plus today's substitutions. */
    suspend fun timetable(childId: String): Timetable
    /** Upcoming exams with their per-subject date sheet, for the child's class only. */
    suspend fun examSchedules(childId: String): List<ExamSchedule>
    /** Notification centre entries for all of the parent's children, newest first. */
    suspend fun notifications(): List<AppNotification>
    suspend fun markAllRead()
    /** Tells the backend which language the parent chose: `PATCH /parent/preferences {language}` with "en" or "hi". Fire-and-forget for the caller. */
    suspend fun setLanguage(code: String)
    /** Registers this device for push. [platform] is "android" or "ios". */
    suspend fun registerDevice(token: String, platform: String)
    /** Open feedback requests for the child's class (answered ones included, closed ones left out). Empty if the child left school. */
    suspend fun feedbackRequests(childId: String): List<FeedbackRequest>
    /** Sends the ratings the parent filled in. At least one star is required. */
    suspend fun submitFeedback(requestId: String, childId: String, ratings: List<FeedbackRating>)
}
