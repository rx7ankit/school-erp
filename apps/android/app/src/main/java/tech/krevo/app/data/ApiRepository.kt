package tech.krevo.app.data

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import org.json.JSONObject
import tech.krevo.app.domain.AppError
import tech.krevo.app.domain.AppException
import tech.krevo.app.domain.AppNotification
import tech.krevo.app.domain.AttendanceDay
import tech.krevo.app.domain.AttendanceMonth
import tech.krevo.app.domain.AttendanceStatus
import tech.krevo.app.domain.CalendarEvent
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.ChildStatus
import tech.krevo.app.domain.EventKind
import tech.krevo.app.domain.ExamDetail
import tech.krevo.app.domain.ExamPaper
import tech.krevo.app.domain.ExamSchedule
import tech.krevo.app.domain.ExamSummary
import tech.krevo.app.domain.FeedbackRating
import tech.krevo.app.domain.FeedbackRequest
import tech.krevo.app.domain.FeedbackTarget
import tech.krevo.app.domain.Invoice
import tech.krevo.app.domain.InvoiceLine
import tech.krevo.app.domain.Ist
import tech.krevo.app.domain.LeaveHalf
import tech.krevo.app.domain.LeaveRequest
import tech.krevo.app.domain.LeaveStatus
import tech.krevo.app.domain.MessageAttachment
import tech.krevo.app.domain.Notice
import tech.krevo.app.domain.NotificationType
import tech.krevo.app.domain.Payment
import tech.krevo.app.domain.PaymentMode
import tech.krevo.app.domain.PaymentStatus
import tech.krevo.app.domain.Period
import tech.krevo.app.domain.Substitution
import tech.krevo.app.domain.SubjectMark
import tech.krevo.app.domain.TeacherThread
import tech.krevo.app.domain.ThreadMessage
import tech.krevo.app.domain.ThreadStatus
import tech.krevo.app.domain.Timetable
import tech.krevo.app.domain.TimetableSlot
import tech.krevo.app.domain.TodayAttendance
import tech.krevo.app.domain.Update
import tech.krevo.app.domain.UpdateKind
import tech.krevo.app.domain.User
import tech.krevo.app.domain.UserKind
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime
import java.time.YearMonth

/**
 * The parent-side backend: every call goes to the Krevo API, and each response is mapped to the app's own models here,
 * so no screen sees the wire format.
 */
class ApiRepository(private val api: ApiClient) : Repository {
    @Volatile private var password = ""   // memory only, for the forced "choose a new password" step

    // ---- sign in --------------------------------------------------------------------------------------------------

    override suspend fun login(email: String, password: String): User {
        val token = try {
            api.login(email.trim(), password)
        } catch (e: ApiException) {
            // A wrong email or password is the one sign-in failure with its own wording.
            throw if (e.code == "invalid_credentials") AppException(AppError.WRONG_LOGIN) else e
        }
        val me = api.getObject("/auth/me")
        val kind = when (me.getString("kind")) {
            "parent" -> UserKind.PARENT
            "staff" -> UserKind.STAFF
            else -> { api.signOut(); throw ApiException("Platform owners sign in on the web.") }
        }
        this.password = password
        return User(me.getString("id"), me.getString("name"), kind, token.mustChangePassword)
    }

    override val hasSavedSession: Boolean get() = api.hasSession

    override suspend fun restore(): User? {
        if (!api.hasSession) return null
        val me = api.getObject("/auth/me")   // throws ApiException when unreachable; session is kept
        val kind = when (me.getString("kind")) {
            "parent" -> UserKind.PARENT
            "staff" -> UserKind.STAFF
            else -> { api.signOut(); return null }
        }
        // The forced "choose a new password" step needs the temporary password typed at sign in, which is gone after a restart.
        if (me.optBoolean("must_change_password")) { api.signOut(); return null }
        return User(me.getString("id"), me.getString("name"), kind, false)
    }

    override fun setOnSessionEnded(callback: () -> Unit) { api.onSessionEnded = callback }

    override suspend fun signOut() { password = ""; api.signOut() }

    override suspend fun changePassword(newPassword: String) {
        api.send("POST", "/auth/change-password", JSONObject().put("current_password", password).put("new_password", newPassword))
        password = newPassword
    }

    // ---- children -------------------------------------------------------------------------------------------------

    override suspend fun children(): List<Child> = coroutineScope {
        api.getArray("/parent/children").mapObjects { c ->
            val id = c.getString("student_id")
            val detail = async { api.getObject("/parent/children/$id") }
            val d = detail.await()
            Child(
                id = id,
                name = c.getString("name"),
                className = c.str("class_label").orEmpty(),
                rollNo = c.int("roll_no"),
                scholarNo = c.getString("scholar_no"),
                dob = d.str("dob")?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: LocalDate.of(2010, 1, 1),
                guardians = d.arr("guardians").mapObjects { it.getString("name") },
                status = if (c.optBoolean("read_only") || c.getString("status") != "active") ChildStatus.LEFT else ChildStatus.ACTIVE,
            )
        }
    }

    // ---- attendance -----------------------------------------------------------------------------------------------

    override suspend fun today(childId: String): TodayAttendance {
        val today = Ist.today()
        val month = attendanceMonth(childId, YearMonth.from(today).toString())
        return TodayAttendance(month.days.firstOrNull { it.date == today }?.status ?: AttendanceStatus.NOT_MARKED, null)
    }

    override suspend fun attendanceMonth(childId: String, month: String): AttendanceMonth {
        val cal = api.getObject("/parent/children/$childId/attendance/calendar", mapOf("month" to month))
        val days = cal.arr("days").mapObjects { d ->
            val status = when {
                d.str("holiday") != null -> AttendanceStatus.HOLIDAY
                else -> when (d.getString("status")) {
                    "full" -> AttendanceStatus.PRESENT
                    "absent" -> AttendanceStatus.ABSENT
                    "leave" -> AttendanceStatus.LEAVE
                    "half" -> if (d.str("first_half") == "present") AttendanceStatus.HALF_FIRST else AttendanceStatus.HALF_SECOND
                    else -> AttendanceStatus.NOT_MARKED
                }
            }
            AttendanceDay(LocalDate.parse(d.getString("day_on")), status)
        }
        return AttendanceMonth(month, days)
    }

    // ---- results --------------------------------------------------------------------------------------------------

    override suspend fun exams(childId: String): List<ExamSummary> =
        api.getArray("/parent/children/$childId/results").mapObjects { r ->
            val exam = r.getJSONObject("exam")
            ExamSummary(exam.getString("id"), exam.getString("name"), r.dbl("percentage") ?: 0.0, r.getString("published_at"))
        }

    override suspend fun examDetail(childId: String, id: String): ExamDetail {
        val examId = id
        val r = try {
            api.getObject("/parent/children/$childId/results/$examId")
        } catch (e: ApiException) { throw AppException(AppError.RESULT_NOT_FOUND) }
        val marks = r.arr("marks").mapObjects { it }.associateBy { it.getString("subject_id") }
        val subjects = r.arr("papers").mapObjects { p ->
            val m = marks[p.getString("subject_id")]
            SubjectMark(p.getString("subject"), m?.dbl("marks_obtained") ?: 0.0, p.getInt("max_marks"))
        }
        val exam = r.getJSONObject("exam")
        return ExamDetail(examId, exam.getString("name"), subjects, r.str("remark").orEmpty(), r.str("published_at").orEmpty())
    }

    override suspend fun examSchedules(childId: String): List<ExamSchedule> =
        api.getArray("/parent/children/$childId/date-sheet").mapObjects { s ->
            val items = s.arr("items").mapObjects { it }
            val days = items.map { LocalDate.parse(it.getString("paper_on")) }.sorted()
            ExamSchedule(
                s.getString("id"), s.getString("name"), days.firstOrNull() ?: Ist.today(), days.lastOrNull() ?: Ist.today(),
                items.map { ExamPaper(it.getString("subject"), it.getString("starts_at")) },
            )
        }

    // ---- updates, notices, calendar -------------------------------------------------------------------------------

    override suspend fun updates(childId: String): List<Update> {
        val page = api.getObject("/parent/updates", mapOf("student_id" to childId, "limit" to "100"))
        return page.arr("items").mapObjects { u ->
            val school = u.getString("scope") == "school"
            val tag = u.getString("tag")
            Update(
                id = u.getString("id"),
                kind = if (school) UpdateKind.SCHOOL else UpdateKind.CLASS,
                sender = u.getString("sender_name"),
                subject = if (school || tag == "General") null else tag,
                text = u.getString("body"),
                attachment = u.arr("attachments").optJSONObject(0)?.getString("filename"),
                title = u.getString("title"),
                at = u.getString("created_at"),
                read = u.optBoolean("is_read"),
            )
        }
    }

    override suspend fun markUpdatesRead(childId: String) { api.send("POST", "/parent/updates/read-all") }

    override suspend fun notices(): List<Notice> {
        val page = api.getObject("/parent/updates", mapOf("limit" to "100"))
        return page.arr("items").mapObjects { it }.filter { it.getString("scope") == "school" }
            .map { Notice(it.getString("id"), it.getString("title"), it.getString("body"), it.getString("created_at")) }
    }

    override suspend fun calendar(): List<CalendarEvent> =
        api.getArray("/parent/holidays").mapObjects { h ->
            CalendarEvent(
                h.getString("id"), h.getString("title"), LocalDate.parse(h.getString("from_on")), LocalDate.parse(h.getString("to_on")),
                when (h.getString("kind")) { "exam" -> EventKind.EXAM; "event" -> EventKind.EVENT; else -> EventKind.HOLIDAY },
            )
        }

    // ---- messages -------------------------------------------------------------------------------------------------

    override suspend fun teacherThreads(childId: String): List<TeacherThread> {
        val page = api.getObject("/parent/threads", mapOf("student_id" to childId, "limit" to "100"))
        return page.arr("items").mapObjects { t ->
            val classTeacher = t.getString("tag") == "Class teacher"
            TeacherThread(
                id = t.getString("id"), teacher = t.getString("teacher_name"),
                subject = if (classTeacher) "" else t.getString("tag"), isClassTeacher = classTeacher,
                status = if (t.optBoolean("active")) ThreadStatus.ACTIVE else ThreadStatus.INACTIVE,
                lastMessage = t.str("last_message_preview").orEmpty(), lastAt = t.str("last_message_at").orEmpty(), unread = t.int("unread"),
            )
        }
    }

    override suspend fun threadMessages(threadId: String): List<ThreadMessage> {
        val page = api.getObject("/parent/threads/$threadId/messages", mapOf("limit" to "100"))
        try { api.send("POST", "/parent/threads/$threadId/read") } catch (_: Exception) { }
        return page.arr("items").mapObjects { it }.sortedBy { it.getString("created_at") }.map(::message)
    }

    override suspend fun sendMessage(threadId: String, text: String): ThreadMessage {
        if (text.isBlank()) throw AppException(AppError.EMPTY_MESSAGE)
        val m = api.send("POST", "/parent/threads/$threadId/messages", JSONObject().put("body", text.trim())) as JSONObject
        return message(m)
    }

    private fun message(m: JSONObject) = ThreadMessage(
        m.getString("id"), m.optBoolean("mine"), m.str("sender_name").orEmpty(), m.getString("body"), m.getString("created_at"),
        m.arr("attachments").mapObjects { a ->
            MessageAttachment(a.getString("id"), a.getString("filename"), a.getString("content_type"), a.optLong("size_bytes"))
        },
    )

    override suspend fun sendMessage(threadId: String, text: String, attachmentIds: List<String>): ThreadMessage {
        if (text.isBlank() && attachmentIds.isEmpty()) throw AppException(AppError.EMPTY_MESSAGE)
        val body = JSONObject().put("body", text.trim()).put("attachment_ids", org.json.JSONArray(attachmentIds))
        return message(api.send("POST", "/parent/threads/$threadId/messages", body) as JSONObject)
    }

    /** Three steps: ask for an upload link, send the bytes to it, tell the school the file is complete. */
    override suspend fun uploadAttachment(bytes: ByteArray, filename: String, contentType: String): String {
        val start = api.send(
            "POST", "/parent/messaging/upload-url",
            JSONObject().put("filename", filename).put("content_type", contentType).put("size_bytes", bytes.size).put("purpose", "message_attachment"),
        ) as JSONObject
        val headers = start.optJSONObject("headers")?.let { h -> h.keys().asSequence().associateWith { h.getString(it) } } ?: emptyMap()
        api.putBinary(start.getString("upload_url"), bytes, headers, start.optString("method", "PUT"))
        val id = start.getString("id")
        api.send("POST", "/parent/messaging/files/$id/complete", JSONObject())
        return id
    }

    override suspend fun attachmentUrl(attachmentId: String): String =
        (api.send("GET", "/parent/messaging/files/$attachmentId/url") as JSONObject).getString("url")

    // ---- fees -----------------------------------------------------------------------------------------------------

    override suspend fun invoices(childId: String): List<Invoice> = coroutineScope {
        val rows = api.getObject("/parent/children/$childId/fees").arr("invoices").mapObjects { it.getString("id") }
        rows.map { id -> async { api.getObject("/parent/children/$childId/fees/invoices/$id") } }.map { it.await() }.map { d ->
            var late = 0L
            var previous = 0L
            val lines = ArrayList<InvoiceLine>()
            d.arr("items").mapObjects { item ->
                val amount = item.getLong("amount_paise")
                when (item.getString("kind")) {
                    "late_fee" -> late += amount
                    "previous_dues" -> previous += amount
                    "concession" -> lines += InvoiceLine(item.getString("description"), -Math.abs(amount))
                    else -> lines += InvoiceLine(item.getString("description"), amount)
                }
            }
            Invoice(
                id = d.getString("id"), no = d.getString("invoice_no"), period = d.getString("period_label"),
                dueOn = LocalDate.parse(d.getString("due_on")), lines = lines,
                payments = d.arr("payments").mapObjects { p ->
                    Payment(
                        receiptNo = p.getString("receipt_no"),
                        mode = when (p.getString("mode")) {
                            "cheque" -> PaymentMode.CHEQUE; "upi" -> PaymentMode.UPI; "bank_transfer" -> PaymentMode.BANK_TRANSFER
                            "online" -> PaymentMode.ONLINE; else -> PaymentMode.CASH
                        },
                        amountPaise = p.getLong("amount_paise"), at = p.getString("received_at"),
                        receivedBy = p.str("received_by_name") ?: "School office", reference = p.str("reference"),
                        status = if (p.getString("status") == "active") PaymentStatus.ACTIVE else PaymentStatus.CANCELLED,
                    )
                },
                lateFeePaise = late, previousDuesPaise = previous,
            )
        }
    }

    // ---- leave ----------------------------------------------------------------------------------------------------

    override suspend fun leaveRequests(childId: String): List<LeaveRequest> =
        api.getObject("/parent/children/$childId/leave", mapOf("limit" to "100")).arr("items").mapObjects(::leave)

    override suspend fun applyLeave(childId: String, from: LocalDate, to: LocalDate, half: LeaveHalf, reason: String): LeaveRequest {
        if (from.isBefore(Ist.today())) throw AppException(AppError.LEAVE_IN_PAST)
        if (to.isBefore(from)) throw AppException(AppError.LEAVE_DATES)
        if (half != LeaveHalf.NONE && from != to) throw AppException(AppError.LEAVE_HALF_SINGLE_DAY)
        if (reason.isBlank()) throw AppException(AppError.LEAVE_REASON_REQUIRED)
        val body = JSONObject().put("from_on", from.toString()).put("to_on", to.toString())
            .put("half", half.name.lowercase()).put("reason", reason.trim())
        return leave(api.send("POST", "/parent/children/$childId/leave", body) as JSONObject)
    }

    override suspend fun cancelLeave(id: String) { api.send("POST", "/parent/leave/$id/cancel") }

    private fun leave(l: JSONObject) = LeaveRequest(
        id = l.getString("id"), fromOn = LocalDate.parse(l.getString("from_on")), toOn = LocalDate.parse(l.getString("to_on")),
        half = when (l.getString("half")) { "first" -> LeaveHalf.FIRST; "second" -> LeaveHalf.SECOND; else -> LeaveHalf.NONE },
        reason = l.getString("reason"),
        status = when (l.getString("status")) {
            "approved" -> LeaveStatus.APPROVED; "rejected" -> LeaveStatus.REJECTED; "cancelled" -> LeaveStatus.CANCELLED; else -> LeaveStatus.PENDING
        },
        decisionNote = l.str("decision_note"), createdAt = l.getString("created_at"),
    )

    // ---- timetable ------------------------------------------------------------------------------------------------

    override suspend fun timetable(childId: String): Timetable {
        val t = api.getObject("/parent/children/$childId/timetable")
        val periods = t.arr("periods").mapObjects { it }.sortedBy { it.getInt("number") }
        val index = periods.mapIndexed { i, p -> p.getInt("number") to i }.toMap()
        return Timetable(
            periods = periods.mapIndexed { i, p ->
                Period(i, p.getInt("number"), LocalTime.parse(p.getString("starts_at")), LocalTime.parse(p.getString("ends_at")))
            },
            slots = t.arr("slots").mapObjects { s ->
                TimetableSlot(DayOfWeek.of(s.getInt("weekday")), index[s.getInt("period_number")] ?: 0, s.getString("subject_name"), s.getString("staff_name"))
            },
            substitutionsOn = LocalDate.parse(t.getString("on")),
            substitutions = t.arr("today").mapObjects { e ->
                val slot = e.getJSONObject("slot")
                Substitution(index[slot.getInt("period_number")] ?: 0, e.str("substitute_name").orEmpty(), slot.getString("subject_name"))
            }.filter { it.teacher.isNotEmpty() },
        )
    }

    // ---- feedback -------------------------------------------------------------------------------------------------

    override suspend fun feedbackRequests(childId: String): List<FeedbackRequest> =
        api.getArray("/parent/feedback").mapObjects { it }.filter { it.getString("student_id") == childId }.map { r ->
            val targets = r.arr("targets").mapObjects { it }
            FeedbackRequest(
                id = r.getString("request_id"), title = r.getString("title"), closesOn = LocalDate.parse(r.getString("closes_on")),
                targets = targets.map { FeedbackTarget(it.getString("target_id"), it.getString("teacher"), it.str("subject").orEmpty(), it.str("subject") == null) },
                submitted = targets.filter { !it.isNull("my_rating") }.map { FeedbackRating(it.getString("target_id"), it.getInt("my_rating"), it.str("my_comment")) },
            )
        }

    override suspend fun submitFeedback(requestId: String, childId: String, ratings: List<FeedbackRating>) {
        if (ratings.none { it.rating > 0 }) throw AppException(AppError.FEEDBACK_NEEDS_STAR)
        for (r in ratings.filter { it.rating > 0 }) {
            val body = JSONObject().put("rating", r.rating).put("comment", r.comment ?: JSONObject.NULL)
            api.send("PUT", "/parent/feedback/targets/${r.targetId}/children/$childId", body)
        }
    }

    // ---- notifications, language, push ----------------------------------------------------------------------------

    override suspend fun notifications(): List<AppNotification> {
        val childNames = children().associate { it.id to it.firstName }
        val inbox = api.getObject("/parent/notifications", mapOf("limit" to "100"))
        return inbox.arr("items").mapObjects { n ->
            val studentId = n.str("student_id").orEmpty()
            val type = when (n.getString("kind")) {
                "attendance_absent" -> NotificationType.ATTENDANCE_ABSENT
                "attendance_present" -> NotificationType.ATTENDANCE_PRESENT
                "fee_reminder", "fee_invoice", "fee_payment" -> NotificationType.FEE_REMINDER
                "result" -> NotificationType.RESULT_PUBLISHED
                "exam" -> NotificationType.EXAM_DATE_SHEET
                "feedback" -> NotificationType.FEEDBACK_REQUESTED
                "message" -> NotificationType.MESSAGE
                "leave_decided" -> NotificationType.LEAVE_APPROVED
                "broadcast" -> NotificationType.BROADCAST
                else -> NotificationType.NOTICE
            }
            AppNotification(
                id = n.getString("id"), type = type, childId = studentId, childName = childNames[studentId].orEmpty(), at = n.getString("created_at"),
                read = if (n.has("is_read") && !n.isNull("is_read")) n.getBoolean("is_read") else !n.isNull("read_at"),
                deepLink = when (type) {
                    NotificationType.FEE_REMINDER -> "fees"
                    NotificationType.RESULT_PUBLISHED, NotificationType.REPORT_CARD -> "results"
                    NotificationType.MESSAGE, NotificationType.BROADCAST -> "messages"
                    NotificationType.ATTENDANCE_ABSENT, NotificationType.ATTENDANCE_PRESENT, NotificationType.LEAVE_APPROVED -> "attendance"
                    else -> "notices"
                },
                serverTitle = n.str("title"), serverBody = n.str("body"),
            )
        }.filter { it.childId.isEmpty() || it.childId in childNames }
    }

    override suspend fun markAllRead() { api.send("POST", "/parent/notifications/read-all") }

    override suspend fun setLanguage(code: String) { api.send("PATCH", "/parent/preferences", JSONObject().put("language", code)) }

    override suspend fun registerDevice(token: String, platform: String) {
        api.send("POST", "/parent/notifications/devices", JSONObject().put("platform", platform).put("token", token))
    }
}
