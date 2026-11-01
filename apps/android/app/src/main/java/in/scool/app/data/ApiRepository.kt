package `in`.scool.app.data

import `in`.scool.app.domain.AppNotification
import `in`.scool.app.domain.AttendanceMonth
import `in`.scool.app.domain.Broadcast
import `in`.scool.app.domain.CalendarEvent
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.ChatMessage
import `in`.scool.app.domain.ExamDetail
import `in`.scool.app.domain.ExamSchedule
import `in`.scool.app.domain.ExamSummary
import `in`.scool.app.domain.FeedbackRating
import `in`.scool.app.domain.FeedbackRequest
import `in`.scool.app.domain.Invoice
import `in`.scool.app.domain.LeaveHalf
import `in`.scool.app.domain.LeaveRequest
import `in`.scool.app.domain.Timetable
import java.time.LocalDate
import `in`.scool.app.domain.MessageThread
import `in`.scool.app.domain.Notice
import `in`.scool.app.domain.TodayAttendance
import `in`.scool.app.domain.User

/**
 * Stub for the future FastAPI backend. Not wired in: AppContainer uses MockRepository.
 *
 * TODO: POST /auth/login {email,password} -> {access_token, user:{id,name,kind,must_change_password}}
 * TODO: add an HTTP client (HttpURLConnection or OkHttp/Retrofit), store the access token, map JSON to domain models.
 * TODO: timestamps arrive as UTC ISO strings (`*_at`), school dates as "yyyy-MM-dd" (`*_on`), money as paise.
 */
class ApiRepository(private val baseUrl: String) : Repository {
    private fun todo(): Nothing = throw NotImplementedError("Backend not available yet ($baseUrl)")

    override suspend fun login(email: String, password: String): User = todo()
    override suspend fun changePassword(newPassword: String) { todo() }
    override suspend fun children(): List<Child> = todo()
    override suspend fun today(childId: String): TodayAttendance = todo()
    override suspend fun attendanceMonth(childId: String, month: String): AttendanceMonth = todo()
    override suspend fun exams(childId: String): List<ExamSummary> = todo()
    override suspend fun examDetail(id: String): ExamDetail = todo()
    override suspend fun broadcasts(childId: String): List<Broadcast> = todo()
    override suspend fun threads(childId: String): List<MessageThread> = todo()
    override suspend fun messages(threadId: String): List<ChatMessage> = todo()
    override suspend fun send(threadId: String, text: String): ChatMessage = todo()
    override suspend fun invoices(childId: String): List<Invoice> = todo()
    override suspend fun notices(): List<Notice> = todo()
    override suspend fun calendar(): List<CalendarEvent> = todo()
    override suspend fun leaveRequests(childId: String): List<LeaveRequest> = todo()
    override suspend fun applyLeave(childId: String, from: LocalDate, to: LocalDate, half: LeaveHalf, reason: String): LeaveRequest = todo()
    override suspend fun cancelLeave(id: String) { todo() }
    override suspend fun timetable(childId: String): Timetable = todo()
    override suspend fun examSchedules(childId: String): List<ExamSchedule> = todo()
    override suspend fun notifications(): List<AppNotification> = todo()
    override suspend fun markAllRead() { todo() }
    override suspend fun registerDevice(token: String, platform: String) { todo() }
    override suspend fun feedbackRequests(childId: String): List<FeedbackRequest> = todo()
    override suspend fun submitFeedback(requestId: String, childId: String, ratings: List<FeedbackRating>) { todo() }
}
