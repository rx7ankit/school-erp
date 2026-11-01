package `in`.scool.app.data

import `in`.scool.app.domain.AttendanceMonth
import `in`.scool.app.domain.Broadcast
import `in`.scool.app.domain.CalendarEvent
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.ChatMessage
import `in`.scool.app.domain.ExamDetail
import `in`.scool.app.domain.ExamSummary
import `in`.scool.app.domain.FeedbackRating
import `in`.scool.app.domain.FeedbackRequest
import `in`.scool.app.domain.Invoice
import `in`.scool.app.domain.MessageThread
import `in`.scool.app.domain.Notice
import `in`.scool.app.domain.TodayAttendance
import `in`.scool.app.domain.User

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
    suspend fun broadcasts(childId: String): List<Broadcast>
    suspend fun threads(childId: String): List<MessageThread>
    suspend fun messages(threadId: String): List<ChatMessage>
    suspend fun send(threadId: String, text: String): ChatMessage
    suspend fun invoices(childId: String): List<Invoice>
    suspend fun notices(): List<Notice>
    suspend fun calendar(): List<CalendarEvent>
    /** Open feedback requests for the child's class (answered ones included, closed ones left out). Empty if the child left school. */
    suspend fun feedbackRequests(childId: String): List<FeedbackRequest>
    /** Sends the ratings the parent filled in. At least one star is required. */
    suspend fun submitFeedback(requestId: String, childId: String, ratings: List<FeedbackRating>)
}
