package tech.krevo.app.data

import tech.krevo.app.domain.AppNotification
import tech.krevo.app.domain.AttendanceMonth
import tech.krevo.app.domain.CalendarEvent
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.ExamDetail
import tech.krevo.app.domain.ExamSchedule
import tech.krevo.app.domain.ExamSummary
import tech.krevo.app.domain.FeedbackRating
import tech.krevo.app.domain.FeedbackRequest
import tech.krevo.app.domain.Invoice
import tech.krevo.app.domain.TeacherThread
import tech.krevo.app.domain.ThreadMessage
import tech.krevo.app.domain.Update
import tech.krevo.app.domain.LeaveHalf
import tech.krevo.app.domain.LeaveRequest
import tech.krevo.app.domain.Timetable
import java.time.LocalDate
import tech.krevo.app.domain.Notice
import tech.krevo.app.domain.TodayAttendance
import tech.krevo.app.domain.User

/**
 * Everything the app reads or writes. Parents are read-only except messaging and changing password.
 * Implementations throw an exception with a user-readable message on failure.
 */
interface Repository {
    suspend fun login(email: String, password: String): User
    /** Ends the server session and forgets the tokens on this phone. */
    suspend fun signOut() {}
    suspend fun changePassword(newPassword: String)
    suspend fun children(): List<Child>
    suspend fun today(childId: String): TodayAttendance
    /** [month] is "yyyy-MM". */
    suspend fun attendanceMonth(childId: String, month: String): AttendanceMonth
    suspend fun exams(childId: String): List<ExamSummary>
    suspend fun examDetail(childId: String, id: String): ExamDetail
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
