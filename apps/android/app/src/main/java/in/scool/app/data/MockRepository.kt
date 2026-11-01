package `in`.scool.app.data

import `in`.scool.app.domain.AppError
import `in`.scool.app.domain.AppException
import `in`.scool.app.domain.AppNotification
import `in`.scool.app.domain.AttendanceDay
import `in`.scool.app.domain.AttendanceMonth
import `in`.scool.app.domain.AttendanceStatus
import `in`.scool.app.domain.CalendarEvent
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.ExamDetail
import `in`.scool.app.domain.ExamPaper
import `in`.scool.app.domain.ExamSchedule
import `in`.scool.app.domain.ExamSummary
import `in`.scool.app.domain.FEEDBACK_COMMENT_MAX
import `in`.scool.app.domain.FEEDBACK_MAX_STARS
import `in`.scool.app.domain.FeedbackRating
import `in`.scool.app.domain.FeedbackRequest
import `in`.scool.app.domain.FeedbackTarget
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.TeacherThread
import `in`.scool.app.domain.ThreadMessage
import `in`.scool.app.domain.ThreadStatus
import `in`.scool.app.domain.Update
import `in`.scool.app.domain.UpdateKind
import `in`.scool.app.domain.LEAVE_REASON_MAX
import `in`.scool.app.domain.LeaveHalf
import `in`.scool.app.domain.LeaveRequest
import `in`.scool.app.domain.LeaveStatus
import `in`.scool.app.domain.Period
import `in`.scool.app.domain.PaymentStatus
import `in`.scool.app.domain.Substitution
import `in`.scool.app.domain.Timetable
import `in`.scool.app.domain.TimetableSlot
import java.time.DayOfWeek
import java.time.LocalTime
import `in`.scool.app.domain.Invoice
import `in`.scool.app.domain.InvoiceLine
import `in`.scool.app.domain.NotificationType
import `in`.scool.app.domain.Notice
import `in`.scool.app.domain.Payment
import `in`.scool.app.domain.PaymentMode
import `in`.scool.app.domain.SubjectMark
import `in`.scool.app.domain.TodayAttendance
import `in`.scool.app.domain.User
import `in`.scool.app.domain.UserKind
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.YearMonth

/** In-memory demo backend. Demo accounts are listed in the README. */
class MockRepository : Repository {

    private class Account(var password: String, val user: User, val children: List<Child>)

    private val accounts: Map<String, Account> = mapOf(
        "parent@demo.in" to Account("Scool@123",
            User("u1", "Rakesh Tiwari", UserKind.PARENT, false), listOf(MockData.aarav, MockData.diya)),
        "staff@demo.in" to Account("Scool@123",
            User("u2", "Meera Rao", UserKind.STAFF, false), emptyList()),
        "new@demo.in" to Account("Temp@1234",
            User("u3", "Rakesh Tiwari", UserKind.PARENT, true), listOf(MockData.aarav, MockData.diya)),
        // Extra demo account (not in the spec): shows the "left school" state.
        "left@demo.in" to Account("Scool@123",
            User("u4", "Rakesh Tiwari", UserKind.PARENT, false), listOf(MockData.diya, MockData.riya)),
    )

    private var current: Account? = null

    private suspend fun latency() = delay(250)

    override suspend fun login(email: String, password: String): User {
        latency()
        val acc = accounts[email.trim().lowercase()]
        if (acc == null || acc.password != password) {
            throw AppException(AppError.WRONG_LOGIN)
        }
        current = acc
        return acc.user
    }

    override suspend fun changePassword(newPassword: String) {
        latency()
        val acc = current ?: throw AppException(AppError.SIGN_IN_AGAIN)
        acc.password = newPassword
    }

    override suspend fun children(): List<Child> {
        latency()
        return current?.children ?: emptyList()
    }

    // ---------- Attendance ----------

    private fun seed(childId: String): Int = childId.filter { it.isDigit() }.toIntOrNull() ?: 0

    private fun statusOn(child: Child, date: LocalDate): AttendanceStatus {
        val today = Ist.today()
        if (date.isAfter(today)) return AttendanceStatus.NOT_MARKED
        val left = child.leftOn
        if (left != null && date.isAfter(left)) return AttendanceStatus.NOT_MARKED
        if (MockData.isHoliday(date)) return AttendanceStatus.HOLIDAY
        if (date == today) return todayStatus(child)
        return when ((date.dayOfMonth * 3 + seed(child.id) * 5) % 17) {
            4 -> AttendanceStatus.ABSENT
            9 -> AttendanceStatus.HALF_FIRST
            13 -> AttendanceStatus.HALF_SECOND
            15 -> AttendanceStatus.LEAVE
            else -> AttendanceStatus.PRESENT
        }
    }

    private fun todayStatus(child: Child): AttendanceStatus = when {
        !child.isActive -> AttendanceStatus.NOT_MARKED
        MockData.isHoliday(Ist.today()) -> AttendanceStatus.HOLIDAY
        child.id == "st2" -> AttendanceStatus.HALF_SECOND
        else -> AttendanceStatus.PRESENT
    }

    override suspend fun today(childId: String): TodayAttendance {
        latency()
        val child = MockData.child(childId)
        val status = todayStatus(child)
        val marked = when (status) {
            AttendanceStatus.NOT_MARKED, AttendanceStatus.HOLIDAY -> null
            // 03:50 UTC = 9:20 am IST
            else -> "${Ist.today()}T03:50:00Z"
        }
        return TodayAttendance(status, marked)
    }

    override suspend fun attendanceMonth(childId: String, month: String): AttendanceMonth {
        latency()
        val child = MockData.child(childId)
        val ym = YearMonth.parse(month)
        val days = (1..ym.lengthOfMonth()).map { d ->
            val date = ym.atDay(d)
            AttendanceDay(date, statusOn(child, date))
        }
        return AttendanceMonth(month, days)
    }

    // ---------- Results ----------

    private val examNames = listOf("ut1" to "Unit Test 1", "ut2" to "Unit Test 2")
    private val examPublished = mapOf("ut1" to "2026-09-18T09:30:00Z", "ut2" to "2026-10-27T08:15:00Z")

    private fun detailFor(childId: String, key: String): ExamDetail {
        val exam = examNames.indexOfFirst { it.first == key }
        val marks = MockData.subjects.mapIndexed { i, subject ->
            SubjectMark(subject, 28 + (seed(childId) * 3 + i * 7 + exam * 5) % 21, 50)
        }
        val pct = marks.sumOf { it.marks } * 100.0 / marks.sumOf { it.max }
        val remark = when {
            pct >= 85 -> "Excellent work. Keep up the steady effort."
            pct >= 70 -> "Good progress. A little more practice in weaker subjects will help."
            else -> "Needs more regular revision. Please meet the class teacher."
        }
        // Attendance for the period: 1 April to the publish date, half day = 0.5 (same rule as the Attendance tab).
        val child = MockData.child(childId)
        val from = LocalDate.of(2026, 4, 1)
        val to = minOf(Ist.today(), LocalDate.parse(examPublished.getValue(key).substringBefore('T')))
        val days = generateSequence(from) { it.plusDays(1) }.takeWhile { !it.isAfter(to) }
            .map { AttendanceDay(it, statusOn(child, it)) }.toList()
        val attendance = AttendanceMonth("period", days).percent
        return ExamDetail("$childId-$key", examNames[exam].second, marks, remark, examPublished.getValue(key), attendance, from, to)
    }

    override suspend fun exams(childId: String): List<ExamSummary> {
        latency()
        return examNames.map { (key, _) -> detailFor(childId, key) }
            .map { ExamSummary(it.id, it.name, it.percentage, it.publishedAt) }
            .sortedByDescending { it.publishedAt }
    }

    override suspend fun examDetail(id: String): ExamDetail {
        latency()
        val childId = id.substringBefore('-')
        val key = id.substringAfter('-')
        if (examNames.none { it.first == key }) throw AppException(AppError.RESULT_NOT_FOUND)
        return detailFor(childId, key)
    }

    // ---------- Messages ----------

    private class MockThread(
        val id: String,
        val teacher: String,
        val subject: String,
        val isClassTeacher: Boolean,
        val active: Boolean,
        val messages: MutableList<ThreadMessage>,
        var unread: Int,
    )

    private val threadStore = HashMap<String, List<MockThread>>()
    private val updatesRead = HashSet<String>()

    private fun threadsOf(childId: String): List<MockThread> = threadStore.getOrPut(childId) {
        fun t(idx: Int, teacher: String, subject: String, ct: Boolean, active: Boolean, unread: Int, vararg msgs: Triple<Boolean, String, String>) =
            MockThread(
                "th-$childId-$idx", teacher, subject, ct, active,
                msgs.mapIndexed { i, (mine, body, at) ->
                    ThreadMessage("th-$childId-$idx-${i + 1}", mine, if (mine) "You" else teacher, body, at)
                }.toMutableList(),
                unread,
            )
        when (childId) {
            // Aarav, 8-B: class teacher, English with the current teacher, Science, and the former English teacher (previous).
            "st1" -> listOf(
                t(0, "Rajiv Mishra", "Mathematics", true, true, 1,
                    Triple(false, "Hello, this is Rajiv Mishra, Aarav's class teacher. Write here if you have any question.", "2026-10-20T06:30:00Z"),
                    Triple(true, "Thank you, sir. We will meet on Saturday.", "2026-10-29T12:45:00Z"),
                    Triple(false, "Please bring Aarav's progress diary on Saturday.", "2026-10-31T10:05:00Z")),
                t(1, "Sunita Dwivedi", "English", false, true, 0,
                    Triple(false, "Welcome. I am Aarav's English teacher this term.", "2026-10-26T07:00:00Z"),
                    Triple(true, "Thank you, ma'am.", "2026-10-26T09:10:00Z")),
                t(2, "Farhan Khan", "Science", false, true, 0,
                    Triple(false, "The lab record file is due on Monday.", "2026-10-28T08:20:00Z")),
                t(3, "Anita Joshi", "English", false, false, 0,
                    Triple(false, "Aarav's reading has improved a lot this term.", "2026-08-18T06:00:00Z"),
                    Triple(true, "Thank you, ma'am.", "2026-08-18T08:40:00Z")),
            )
            // Diya, 6-A: her own set, with a previous Hindi teacher.
            "st2" -> listOf(
                t(0, "Sunita Dwivedi", "English", true, true, 2,
                    Triple(false, "Hello, this is Sunita Dwivedi, Diya's class teacher.", "2026-10-21T06:30:00Z"),
                    Triple(false, "Diya read very well in class today.", "2026-10-30T09:15:00Z")),
                t(1, "Pooja Singh", "Hindi", false, true, 0,
                    Triple(false, "Please practise the poem for Friday.", "2026-10-27T07:40:00Z"),
                    Triple(true, "We will, thank you.", "2026-10-27T11:00:00Z")),
                t(2, "Rajiv Mishra", "Mathematics", false, true, 0,
                    Triple(false, "Diya should revise tables 12 to 15.", "2026-10-25T08:00:00Z")),
                t(3, "Mahesh Tripathi", "Hindi", false, false, 0,
                    Triple(false, "Diya's handwriting is improving nicely.", "2026-07-30T06:10:00Z")),
            )
            // Riya (left school): everything read-only.
            else -> listOf(
                t(0, "Dinesh Gupta", "Social Science", true, true, 0,
                    Triple(false, "Riya's records are ready at the school office.", "2026-09-29T06:00:00Z")),
                t(1, "Rajiv Mishra", "Mathematics", false, true, 0,
                    Triple(false, "Best wishes to Riya for her new school.", "2026-09-30T07:30:00Z")),
            )
        }
    }

    private fun updatesFor(child: Child): List<Update> {
        val school = Update("u1-${child.id}", UpdateKind.SCHOOL, "Principal's Office", null,
            "Diwali holidays: school will stay closed from 8 to 12 November. Classes resume on 13 November.", null, "2026-10-30T05:00:00Z", true)
        val list = when (child.id) {
            "st1" -> listOf(
                school,
                Update("u2-st1", UpdateKind.CLASS, "Rajiv Mishra", "Mathematics", "Homework for Friday is uploaded. Please check the practice sheet.", "Practice-Sheet.pdf", "2026-10-31T09:20:00Z", false),
                Update("u3-st1", UpdateKind.CLASS, "Sunita Dwivedi", "English", "Class 8-B: reading assignment for next week. Bring your notebooks on Monday.", null, "2026-10-30T07:05:00Z", false),
                Update("u4-st1", UpdateKind.CLASS, "Farhan Khan", "Science", "Project guidelines are attached. Submission is due before the Diwali break.", "Project-Guidelines.pdf", "2026-10-28T06:30:00Z", true),
            )
            "st2" -> listOf(
                school,
                Update("u2-st2", UpdateKind.CLASS, "Sunita Dwivedi", null, "Class 6-A: please send the signed reading diary by Friday.", null, "2026-10-31T08:10:00Z", false),
                Update("u3-st2", UpdateKind.CLASS, "Pooja Singh", "Hindi", "Poem recitation on Friday. Practise at home.", null, "2026-10-29T07:20:00Z", false),
                Update("u4-st2", UpdateKind.CLASS, "Rajiv Mishra", "Mathematics", "Worksheet on multiplication is attached.", "Multiplication-Worksheet.pdf", "2026-10-27T06:45:00Z", true),
            )
            else -> listOf(
                school,
                Update("u2-st3", UpdateKind.CLASS, "Dinesh Gupta", null, "Wishing all students a safe Diwali.", null, "2026-10-29T06:00:00Z", true),
                Update("u3-st3", UpdateKind.CLASS, "Rajiv Mishra", "Mathematics", "Chapter 6 notes are attached.", "Chapter-6-Notes.pdf", "2026-10-26T06:30:00Z", true),
            )
        }
        return list.map { it.copy(read = it.read || it.id in updatesRead) }.sortedByDescending { it.at }
    }

    override suspend fun updates(childId: String): List<Update> {
        latency()
        return updatesFor(MockData.child(childId))
    }

    override suspend fun markUpdatesRead(childId: String) {
        updatesRead.addAll(updatesFor(MockData.child(childId)).map { it.id })
    }

    override suspend fun teacherThreads(childId: String): List<TeacherThread> {
        latency()
        val all = threadsOf(childId).map {
            TeacherThread(
                it.id, it.teacher, it.subject, it.isClassTeacher,
                if (it.active) ThreadStatus.ACTIVE else ThreadStatus.INACTIVE,
                it.messages.last().body, it.messages.last().at, it.unread,
            )
        }
        val active = all.filter { it.isActive }
            .sortedWith(compareByDescending<TeacherThread> { it.isClassTeacher }.thenByDescending { it.lastAt })
        return active + all.filter { !it.isActive }.sortedByDescending { it.lastAt }
    }

    private fun findThread(threadId: String): Pair<Child, MockThread> {
        val childId = threadId.split('-').getOrNull(1) ?: throw AppException(AppError.THREAD_INACTIVE)
        val thread = threadsOf(childId).firstOrNull { it.id == threadId } ?: throw AppException(AppError.THREAD_INACTIVE)
        return MockData.child(childId) to thread
    }

    override suspend fun threadMessages(threadId: String): List<ThreadMessage> {
        latency()
        val (_, thread) = findThread(threadId)
        thread.unread = 0
        return thread.messages.toList()
    }

    override suspend fun sendMessage(threadId: String, text: String): ThreadMessage {
        latency()
        val (child, thread) = findThread(threadId)
        if (!child.isActive) throw AppException(AppError.MESSAGING_OFF)
        if (!thread.active) throw AppException(AppError.THREAD_INACTIVE)
        val body = text.trim()
        if (body.isEmpty()) throw AppException(AppError.EMPTY_MESSAGE)
        val msg = ThreadMessage("$threadId-${thread.messages.size + 1}", true, "You", body, Ist.nowUtc())
        thread.messages.add(msg)
        return msg
    }

    // ---------- Fees ----------

    private fun gradeOf(className: String): Int = className.substringBefore('-').toInt()

    private fun lines(total: Long): List<InvoiceLine> {
        val tuition = total * 8 / 10
        val activity = total / 8
        return listOf(
            InvoiceLine("Tuition fee", tuition),
            InvoiceLine("Activity fee", activity),
            InvoiceLine("Library and lab fee", total - tuition - activity),
        )
    }

    override suspend fun invoices(childId: String): List<Invoice> {
        latency()
        return invoicesFor(childId)
    }

    private fun invoicesFor(childId: String): List<Invoice> {
        val child = MockData.child(childId)
        val base = (1_200_000L + gradeOf(child.className) * 100_000L)
        val n = seed(childId)
        fun instalment(no: Int, mode: PaymentMode, amount: Long, at: String, by: String, ref: String? = null, status: PaymentStatus = PaymentStatus.ACTIVE) =
            Payment("RCT-$no", mode, amount, at, by, ref, status)

        // Term 1: paid in full. Aarav got a sibling concession and paid a late fee, so its total differs from the plain fee heads.
        val concession = if (childId == "st1") listOf(InvoiceLine("Sibling concession", -100_000L)) else emptyList()
        val late1 = if (childId == "st1") 20_000L else 0L
        val term1Total = base - concession.sumOf { -it.amountPaise } + late1
        val term1 = Invoice(
            "inv-$childId-t1", "INV-${2000 + n}", "Term 1", LocalDate.of(2026, 7, 10), lines(base) + concession,
            listOf(instalment(1000 + n, PaymentMode.CHEQUE, term1Total, "2026-07-06T06:00:00Z", "Anita Sharma", "Cheque 00${4500 + n}")),
            lateFeePaise = late1,
        )

        // Term 2: Aarav pays in two instalments, Diya has a cancelled cash payment and a fresh UPI one, Riya carries previous dues.
        val term2Payments = when (childId) {
            "st1" -> listOf(
                instalment(4012, PaymentMode.UPI, base / 2, "2026-10-14T05:10:00Z", "Anita Sharma", "UPI 4421907811"),
                instalment(4027, PaymentMode.CASH, base / 4, "2026-10-28T06:40:00Z", "Vikas Pandey"),
            )
            "st2" -> listOf(
                instalment(3998, PaymentMode.CASH, base, "2026-10-12T04:30:00Z", "Vikas Pandey", status = PaymentStatus.CANCELLED),
                instalment(4031, PaymentMode.UPI, base, "2026-10-13T07:05:00Z", "Anita Sharma", "UPI 5530118842"),
            )
            else -> emptyList()
        }
        val term2 = Invoice(
            "inv-$childId-t2", "INV-${3000 + n}", "Term 2", LocalDate.of(2026, 11, 10), lines(base), term2Payments,
            previousDuesPaise = if (childId == "st3") 150_000L else 0L,
        )
        return listOf(term2, term1)
    }

    // ---------- Notices and calendar ----------

    override suspend fun notices(): List<Notice> {
        latency()
        return MockData.notices.sortedByDescending { it.publishedAt }
    }

    override suspend fun calendar(): List<CalendarEvent> {
        latency()
        return MockData.calendar.sortedBy { it.fromOn }
    }

    // ---------- Feedback ----------

    /** Ratings sent in this session, keyed by "requestId|childId". */
    private val feedbackSent = HashMap<String, List<FeedbackRating>>()

    private fun feedbackKey(requestId: String, childId: String) = "$requestId|$childId"

    private fun feedbackTargets(child: Child): List<FeedbackTarget> =
        MockData.teachers(child.className).mapIndexed { i, t -> FeedbackTarget("t${i + 1}", t.name, t.subject, t.isClassTeacher) }

    private fun feedbackRequestsFor(child: Child): List<FeedbackRequest> {
        if (!child.isActive) return emptyList()
        val targets = feedbackTargets(child)
        val open = FeedbackRequest(
            id = "fb-term2-${child.id}", title = "Term 2 teacher feedback",
            closesOn = Ist.today().plusWeeks(3), targets = targets,
            submitted = feedbackSent[feedbackKey("fb-term2-${child.id}", child.id)].orEmpty(),
        )
        val doneId = "fb-term1-${child.id}"
        val done = FeedbackRequest(
            id = doneId, title = "Term 1 teacher feedback",
            closesOn = Ist.today().plusWeeks(1), targets = targets,
            submitted = feedbackSent[feedbackKey(doneId, child.id)]
                ?: targets.take(2).mapIndexed { i, t -> FeedbackRating(t.id, 5 - i, if (i == 0) "Explains clearly." else null) },
        )
        return listOf(open, done)
    }

    override suspend fun feedbackRequests(childId: String): List<FeedbackRequest> {
        latency()
        return feedbackRequestsFor(MockData.child(childId))
    }

    override suspend fun submitFeedback(requestId: String, childId: String, ratings: List<FeedbackRating>) {
        latency()
        val request = feedbackRequestsFor(MockData.child(childId)).firstOrNull { it.id == requestId }
            ?: throw AppException(AppError.FEEDBACK_CLOSED)
        if (request.answered) throw AppException(AppError.FEEDBACK_ALREADY_SENT)
        val valid = ratings.filter { r ->
            r.rating in 1..FEEDBACK_MAX_STARS && request.targets.any { it.id == r.targetId }
        }.map { it.copy(comment = it.comment?.trim()?.take(FEEDBACK_COMMENT_MAX)?.ifEmpty { null }) }
        if (valid.isEmpty()) throw AppException(AppError.FEEDBACK_NEEDS_STAR)
        feedbackSent[feedbackKey(requestId, childId)] = valid
    }

    // ---------- Exam date sheet ----------

    override suspend fun examSchedules(childId: String): List<ExamSchedule> {
        latency()
        val child = MockData.child(childId)
        // Same window as the "Half-yearly Exams" calendar event. 09:00 IST for seniors, 10:00 IST for juniors.
        val start = if (gradeOf(child.className) >= 8) "03:30:00Z" else "04:30:00Z"
        val days = listOf("2026-11-23", "2026-11-26", "2026-11-30", "2026-12-02", "2026-12-04")
        val subjects = MockData.subjects.let { list -> list.drop(seed(childId) % list.size) + list.take(seed(childId) % list.size) }
        val papers = subjects.mapIndexed { i, subject -> ExamPaper(subject, "${days[i]}T$start") }
        return listOf(ExamSchedule("hy-$childId", "Half-yearly Exams", LocalDate.of(2026, 11, 23), LocalDate.of(2026, 12, 4), papers))
    }

    // ---------- Notifications ----------

    private val readIds = HashSet<String>()
    private val devices = ArrayList<Pair<String, String>>()

    override suspend fun notifications(): List<AppNotification> {
        latency()
        val kids = current?.children.orEmpty()
        val today = Ist.today()
        fun day(offset: Long) = "${today.minusDays(offset)}T03:50:00Z"
        return kids.flatMap { c ->
            fun n(key: String, type: NotificationType, at: String, link: String, read: Boolean = false,
                  amount: Long? = null, due: LocalDate? = null, subject: String? = null,
                  sender: String? = null, preview: String? = null) =
                AppNotification("$key-${c.id}", type, c.id, c.firstName, at, read, link, amount, due, subject, sender, preview)
            val term2 = invoicesFor(c.id).first { it.period == "Term 2" }
            buildList {
                if (c.isActive) {
                    add(n("a1", NotificationType.ATTENDANCE_PRESENT, day(0), "attendance"))
                    add(n("a2", NotificationType.ATTENDANCE_ABSENT, day(1), "attendance"))
                    add(n("a3", NotificationType.ATTENDANCE_FIRST_HALF, day(2), "attendance", read = true))
                    add(n("a4", NotificationType.ATTENDANCE_SECOND_HALF, day(3), "attendance", read = true))
                    add(n("l1", NotificationType.LEAVE_APPROVED, "2026-10-26T06:00:00Z", "leave", read = true, subject = "Approved. Take care and get well soon."))
                    add(n("l2", NotificationType.LEAVE_REJECTED, "2026-10-31T06:00:00Z", "leave", subject = "Exams are close. Please meet the class teacher."))
                    val update = updatesFor(c).first { it.kind == UpdateKind.CLASS }
                    val chat = threadsOf(c.id).first().let { it to it.messages.last() }
                    add(n("bs", NotificationType.BROADCAST, "2026-10-30T05:00:00Z", "messages", read = true, preview = updatesFor(c).first { it.kind == UpdateKind.SCHOOL }.text))
                    add(n("bt", NotificationType.BROADCAST, update.at, "messages", subject = update.subject, sender = update.sender, preview = update.text))
                    add(n("m1", NotificationType.MESSAGE, chat.second.at, "thread/${chat.first.id}", sender = chat.first.teacher, preview = chat.second.body))
                    add(n("fb", NotificationType.FEEDBACK_REQUESTED, "2026-10-31T10:30:00Z", "feedback/fb-term2-${c.id}"))
                }
                if (term2.balancePaise > 0) {
                    add(n("f1", NotificationType.FEE_REMINDER, "2026-10-30T04:00:00Z", "fees", amount = term2.balancePaise, due = term2.dueOn))
                }
                add(n("n1", NotificationType.NOTICE, "2026-10-30T05:00:00Z", "notices", subject = "Diwali holidays announced"))
                add(n("e1", NotificationType.EXAM_DATE_SHEET, "2026-10-28T08:30:00Z", "notices/exams", read = true, subject = "Half-yearly Exams"))
                add(n("rc", NotificationType.REPORT_CARD, "2026-10-27T08:20:00Z", "results/${c.id}-ut2", subject = "Unit Test 2"))
                add(n("r1", NotificationType.RESULT_PUBLISHED, "2026-10-27T08:15:00Z", "results/${c.id}-ut2", read = true, subject = "Unit Test 2"))
            }
        }.map { it.copy(read = it.read || it.id in readIds) }.sortedByDescending { it.at }
    }

    override suspend fun markAllRead() {
        latency()
        current?.children.orEmpty().forEach { c ->
            listOf("a1", "a2", "a3", "a4", "l1", "l2", "rc", "bs", "bt", "m1", "fb", "f1", "n1", "e1", "r1").forEach { readIds.add("$it-${c.id}") }
        }
    }

    override suspend fun registerDevice(token: String, platform: String) {
        latency()
        devices.add(token to platform)
    }

    // ---------- Leave ----------

    private val leave = HashMap<String, MutableList<LeaveRequest>>()

    private fun leaveFor(childId: String): MutableList<LeaveRequest> = leave.getOrPut(childId) {
        val today = Ist.today()
        mutableListOf(
            LeaveRequest("lv-$childId-1", today.plusDays(3), today.plusDays(4), LeaveHalf.NONE,
                "Family wedding in Satna.", LeaveStatus.PENDING, null, "${today.minusDays(1)}T05:00:00Z"),
            LeaveRequest("lv-$childId-2", today.minusDays(20), today.minusDays(19), LeaveHalf.NONE,
                "Fever and rest advised by the doctor.", LeaveStatus.APPROVED, "Approved. Take care and get well soon.", "${today.minusDays(21)}T04:30:00Z"),
            LeaveRequest("lv-$childId-3", today.minusDays(9), today.minusDays(9), LeaveHalf.FIRST,
                "Dentist appointment in the morning.", LeaveStatus.REJECTED, "Exams are close. Please meet the class teacher.", "${today.minusDays(10)}T06:15:00Z"),
        )
    }

    override suspend fun leaveRequests(childId: String): List<LeaveRequest> {
        latency()
        return leaveFor(childId).sortedByDescending { it.createdAt }
    }

    override suspend fun applyLeave(childId: String, from: LocalDate, to: LocalDate, half: LeaveHalf, reason: String): LeaveRequest {
        latency()
        val child = MockData.child(childId)
        val text = reason.trim()
        when {
            !child.isActive -> throw AppException(AppError.LEAVE_CHILD_LEFT)
            text.isEmpty() -> throw AppException(AppError.LEAVE_REASON_REQUIRED)
            text.length > LEAVE_REASON_MAX -> throw AppException(AppError.LEAVE_REASON_TOO_LONG)
            to.isBefore(from) -> throw AppException(AppError.LEAVE_DATES)
            from.isBefore(Ist.today()) -> throw AppException(AppError.LEAVE_IN_PAST)
            half != LeaveHalf.NONE && from != to -> throw AppException(AppError.LEAVE_HALF_SINGLE_DAY)
        }
        val list = leaveFor(childId)
        val request = LeaveRequest("lv-$childId-${list.size + 1}", from, to, half, text, LeaveStatus.PENDING, null, Ist.nowUtc())
        list.add(request)
        return request
    }

    override suspend fun cancelLeave(id: String) {
        latency()
        for (list in leave.values) {
            val i = list.indexOfFirst { it.id == id }
            if (i >= 0) {
                if (list[i].status != LeaveStatus.PENDING) throw AppException(AppError.LEAVE_NOT_PENDING)
                list[i] = list[i].copy(status = LeaveStatus.CANCELLED)
                return
            }
        }
        throw AppException(AppError.LEAVE_NOT_PENDING)
    }

    // ---------- Timetable ----------

    override suspend fun timetable(childId: String): Timetable {
        latency()
        val child = MockData.child(childId)
        val teachers = MockData.teachers(child.className)
        // 6 periods and a break (7 rows). School time, never converted.
        val periods = listOf(
            Period(0, 1, LocalTime.of(9, 0), LocalTime.of(9, 40)),
            Period(1, 2, LocalTime.of(9, 40), LocalTime.of(10, 20)),
            Period(2, 3, LocalTime.of(10, 20), LocalTime.of(11, 0)),
            Period(3, null, LocalTime.of(11, 0), LocalTime.of(11, 20)),
            Period(4, 4, LocalTime.of(11, 20), LocalTime.of(12, 0)),
            Period(5, 5, LocalTime.of(12, 0), LocalTime.of(12, 40)),
            Period(6, 6, LocalTime.of(12, 40), LocalTime.of(13, 20)),
        )
        val slots = ArrayList<TimetableSlot>()
        for (day in DayOfWeek.entries.filter { it != DayOfWeek.SUNDAY }) {
            for (p in periods) {
                val no = p.no ?: continue
                if (day == DayOfWeek.SATURDAY && no > 4) continue // Saturday is a half day
                val t = teachers[(day.value + no) % teachers.size]
                slots.add(TimetableSlot(day, p.index, t.subject, t.name))
            }
        }
        val today = Ist.today()
        val cover = if (today.dayOfWeek == DayOfWeek.SUNDAY) emptyList() else {
            val original = slots.firstOrNull { it.day == today.dayOfWeek && it.periodIndex == 1 }
            listOfNotNull(original?.let { Substitution(1, "Meena Joshi", it.subject) })
        }
        return Timetable(periods, slots, today, cover)
    }
}
