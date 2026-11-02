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
    override suspend fun updates(childId: String): List<Update> = todo()
    override suspend fun markUpdatesRead(childId: String) { todo() }
    override suspend fun teacherThreads(childId: String): List<TeacherThread> = todo()
    override suspend fun threadMessages(threadId: String): List<ThreadMessage> = todo()
    override suspend fun sendMessage(threadId: String, text: String): ThreadMessage = todo()
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
    // TODO: PATCH /parent/preferences {language: code} (parent token); the response echoes {language}.
    override suspend fun setLanguage(code: String) { todo() }
    override suspend fun registerDevice(token: String, platform: String) { todo() }
    override suspend fun feedbackRequests(childId: String): List<FeedbackRequest> = todo()
    override suspend fun submitFeedback(requestId: String, childId: String, ratings: List<FeedbackRating>) { todo() }
}
