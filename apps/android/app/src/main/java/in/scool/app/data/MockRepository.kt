package `in`.scool.app.data

import `in`.scool.app.domain.AttendanceDay
import `in`.scool.app.domain.AttendanceMonth
import `in`.scool.app.domain.AttendanceStatus
import `in`.scool.app.domain.Broadcast
import `in`.scool.app.domain.CalendarEvent
import `in`.scool.app.domain.ChatMessage
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.ExamDetail
import `in`.scool.app.domain.ExamSummary
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.Invoice
import `in`.scool.app.domain.InvoiceLine
import `in`.scool.app.domain.MessageThread
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

    private val chats = HashMap<String, MutableList<ChatMessage>>()

    private suspend fun latency() = delay(250)

    override suspend fun login(email: String, password: String): User {
        latency()
        val acc = accounts[email.trim().lowercase()]
        if (acc == null || acc.password != password) {
            throw IllegalArgumentException("Incorrect email or password.")
        }
        current = acc
        return acc.user
    }

    override suspend fun changePassword(newPassword: String) {
        latency()
        val acc = current ?: throw IllegalStateException("Please sign in again.")
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
        return ExamDetail("$childId-$key", examNames[exam].second, marks, remark, examPublished.getValue(key))
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
        if (examNames.none { it.first == key }) throw IllegalArgumentException("Result not found.")
        return detailFor(childId, key)
    }

    // ---------- Messages ----------

    override suspend fun broadcasts(childId: String): List<Broadcast> {
        latency()
        val child = MockData.child(childId)
        val t = MockData.teachers(child.className)
        val c = child.className
        return listOf(
            Broadcast("b1-$childId", t[0].subject, t[0].name, "Homework for Friday is uploaded. Please check the practice sheet.", "Practice-Sheet.pdf", "2026-10-31T09:20:00Z"),
            Broadcast("b2-$childId", t[1].subject, t[1].name, "Class $c: reading assignment for next week. Bring your notebooks on Monday.", null, "2026-10-30T07:05:00Z"),
            Broadcast("b3-$childId", t.last().subject, t.last().name, "Project guidelines are attached. Submission is due before the Diwali break.", "Project-Guidelines.pdf", "2026-10-28T06:30:00Z"),
            Broadcast("b4-$childId", t[0].subject, t[0].name, "Unit Test syllabus covers Chapters 5 to 7.", null, "2026-10-24T05:45:00Z"),
        )
    }

    private fun threadId(childId: String, index: Int) = "th-$childId-$index"

    private fun chatFor(threadId: String): MutableList<ChatMessage> = chats.getOrPut(threadId) {
        val teacher = MockData.teachers(MockData.child(threadId.split('-')[1]).className)[threadId.substringAfterLast('-').toInt()]
        mutableListOf(
            ChatMessage("$threadId-1", false, teacher.name, "Hello, this is ${teacher.name} (${teacher.subject}). Write here if you have any question.", "2026-10-29T06:30:00Z"),
        ).also {
            if (teacher.isClassTeacher) {
                it.add(ChatMessage("$threadId-2", true, "You", "Thank you, sir. We will meet on Saturday.", "2026-10-29T12:45:00Z"))
            }
        }
    }

    override suspend fun threads(childId: String): List<MessageThread> {
        latency()
        val child = MockData.child(childId)
        return MockData.teachers(child.className).mapIndexed { i, teacher ->
            val last = chatFor(threadId(childId, i)).last()
            MessageThread(
                id = threadId(childId, i),
                teacher = teacher.name,
                role = if (teacher.isClassTeacher) "Class teacher" else teacher.subject,
                lastMessage = last.body,
                lastAt = last.at,
            )
        }.sortedByDescending { it.lastAt }
    }

    override suspend fun messages(threadId: String): List<ChatMessage> {
        latency()
        return chatFor(threadId).toList()
    }

    override suspend fun send(threadId: String, text: String): ChatMessage {
        latency()
        val body = text.trim()
        if (body.isEmpty()) throw IllegalArgumentException("Write a message first.")
        val list = chatFor(threadId)
        val msg = ChatMessage("$threadId-${list.size + 1}", true, "You", body, Ist.nowUtc())
        list.add(msg)
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
        val child = MockData.child(childId)
        val total = (1_200_000L + gradeOf(child.className) * 100_000L)
        val term1 = Invoice(
            "inv-$childId-t1", "INV-${2000 + seed(childId)}", "Term 1", LocalDate.of(2026, 7, 10), lines(total),
            listOf(Payment("RCT-${1000 + seed(childId)}", PaymentMode.CHEQUE, total, "2026-07-06T06:00:00Z")),
        )
        val term2Payments = when (childId) {
            "st1" -> listOf(Payment("RCT-4012", PaymentMode.UPI, total / 2, "2026-10-14T05:10:00Z"))
            "st2" -> listOf(Payment("RCT-3998", PaymentMode.CASH, total, "2026-10-12T04:30:00Z"))
            else -> emptyList()
        }
        val term2 = Invoice(
            "inv-$childId-t2", "INV-${3000 + seed(childId)}", "Term 2", LocalDate.of(2026, 11, 10), lines(total), term2Payments,
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
}
