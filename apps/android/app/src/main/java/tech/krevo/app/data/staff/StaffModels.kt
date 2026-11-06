package tech.krevo.app.data.staff

import org.json.JSONObject
import tech.krevo.app.data.arr
import tech.krevo.app.data.dbl
import tech.krevo.app.data.int
import tech.krevo.app.data.mapObjects
import tech.krevo.app.data.obj
import tech.krevo.app.data.str
import tech.krevo.app.data.strings
import tech.krevo.app.domain.MessageAttachment

// Staff-side models. They mirror the JSON of the Krevo API. `*_on` values are plain school dates ("2026-11-05"),
// `*_at` values are UTC instants; both stay strings. Parsed with the null-safe helpers in ApiClient.kt.

data class StaffAssignment(val classId: String, val role: String, val subjectId: String?)

data class StaffMe(
    val id: String, val name: String, val email: String, val designation: String?,
    val permissions: List<String>, val assignments: List<StaffAssignment>,
    val schoolName: String?, val schoolLogoUrl: String?, val photoUrl: String?,
) {
    fun has(permission: String): Boolean = permission in permissions
    /** Holds all five permissions: what used to be the admin. */
    val fullAccess: Boolean get() = Permission.ALL.all(::has)
    val canSeeAcademic: Boolean get() = has(Permission.ACADEMIC)
    val canSeeFees: Boolean get() = has(Permission.FEES)
    val canSeeLibrary: Boolean get() = has(Permission.LIBRARY)
    val canAnnounce: Boolean get() = has(Permission.ANNOUNCEMENTS)
    /** May write a notice: to the whole school (Announcements) or to a class they teach. */
    val canWriteNotice: Boolean get() = canAnnounce || assignments.isNotEmpty()
    val canManagePeople: Boolean get() = has(Permission.PEOPLE)
    val classTeacherClassIds: Set<String> get() = assignments.filter { it.role == "class_teacher" }.map { it.classId }.toSet()
    /** Class teacher of at least one class, or full access: may decide leave. */
    val canDecideLeave: Boolean get() = fullAccess || classTeacherClassIds.isNotEmpty()
    val roleTitle: String get() = designation?.takeIf { it.isNotBlank() } ?: if (fullAccess) "Full access" else "Teacher"
    val initials: String get() = initialsOf(name)

    companion object {
        fun from(j: JSONObject): StaffMe {
            val school = j.obj("school")
            return StaffMe(
                id = j.getString("id"), name = j.getString("name"), email = j.str("email").orEmpty(),
                designation = j.str("designation"), permissions = j.strings("permissions"),
                assignments = j.arr("assignments").mapObjects { StaffAssignment(it.getString("class_id"), it.getString("role"), it.str("subject_id")) },
                schoolName = school?.str("name"), schoolLogoUrl = school?.str("logo_url"), photoUrl = j.str("photo_url"),
            )
        }
    }
}

/** "Sunita Rao" as "SR". */
fun initialsOf(name: String): String = name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1).uppercase() }

data class StaffDashboard(
    val students: Int, val classes: Int, val classesMarkedToday: Int, val classesTotal: Int,
    val todayPercentage: Double?, val monthPercentage: Double?,
    val fees: Fees?, val staff: StaffToday?, val resultExam: String?, val resultAverage: Double?,
) {
    data class Fees(val collectedThisMonthPaise: Long, val duesPaise: Long, val duesStudents: Int, val overduePaise: Long)
    data class StaffToday(val absentToday: Int, val activeStaff: Int, val notMarkedToday: Int, val presentToday: Int)

    companion object {
        fun from(j: JSONObject): StaffDashboard {
            val a = j.getJSONObject("attendance")
            val r = j.obj("results")
            return StaffDashboard(
                students = j.int("students"), classes = j.int("classes"),
                classesMarkedToday = a.int("classes_marked_today"), classesTotal = a.int("classes_total"),
                todayPercentage = a.dbl("today_percentage"), monthPercentage = a.dbl("month_percentage"),
                fees = j.obj("fees")?.let { Fees(it.optLong("collected_this_month_paise"), it.optLong("dues_paise"), it.int("dues_students"), it.optLong("overdue_paise")) },
                staff = j.obj("staff")?.let { StaffToday(it.int("absent_today"), it.int("active_staff"), it.int("not_marked_today"), it.int("present_today")) },
                resultExam = r?.str("exam"), resultAverage = r?.dbl("average_percentage"),
            )
        }
    }
}

data class StaffClass(val id: String, val grade: String, val section: String, val students: Int, val subjectIds: List<String>) {
    val label: String get() = if (section.isEmpty()) grade else "$grade-$section"
    companion object {
        fun from(j: JSONObject) = StaffClass(j.getString("id"), j.getString("grade"), j.str("section").orEmpty(), j.int("students"), j.strings("subject_ids"))
    }
}

/** One class on one date, from the Classes overview. */
data class ClassDay(val classId: String, val classLabel: String, val marked: Boolean, val percentage: Double?) {
    companion object {
        fun from(j: JSONObject) = ClassDay(j.getString("class_id"), j.str("class_label").orEmpty(), j.optBoolean("marked"), j.dbl("percentage"))
    }
}

/** Every class this person can see on one date (`GET /attendance/overview`). */
data class DayOverview(
    val dayOn: String, val holiday: String?, val classesTotal: Int, val classesMarked: Int, val percentage: Double?, val classes: List<ClassDay>,
) {
    companion object {
        fun from(j: JSONObject) = DayOverview(
            dayOn = j.getString("day_on"), holiday = j.str("holiday"), classesTotal = j.int("classes_total"), classesMarked = j.int("classes_marked"),
            percentage = j.dbl("percentage"), classes = j.arr("classes").mapObjects { ClassDay.from(it) },
        )
    }
}

/** Who teaches a class: the class teacher (no subject) or the teacher of one subject. */
data class AssignmentRow(val staffName: String, val role: String, val subjectId: String?) {
    companion object {
        fun from(j: JSONObject) = AssignmentRow(j.str("staff_name").orEmpty(), j.str("role").orEmpty(), j.str("subject_id"))
    }
}

data class Subject(val id: String, val name: String)

data class Page<T>(val items: List<T>, val total: Int)

// ---- Attendance

enum class Mark(val wire: String) {
    PRESENT("present"), ABSENT("absent"), LEAVE("leave");
    companion object { fun of(s: String?) = entries.firstOrNull { it.wire == s } ?: PRESENT }
}

data class SheetStudent(
    val studentId: String, val name: String, val rollNo: Int?, val scholarNo: String,
    val firstHalf: Mark, val secondHalf: Mark, val late: Boolean,
)

data class AttendanceSheet(
    val classId: String, val classLabel: String, val dayOn: String, val canMark: Boolean,
    val holiday: String?, val marked: Boolean, val students: List<SheetStudent>,
) {
    companion object {
        fun from(j: JSONObject) = AttendanceSheet(
            classId = j.getString("class_id"), classLabel = j.str("class_label").orEmpty(), dayOn = j.getString("day_on"),
            canMark = j.optBoolean("can_mark"), holiday = j.str("holiday"), marked = j.optBoolean("marked"),
            students = j.arr("students").mapObjects {
                SheetStudent(
                    it.getString("student_id"), it.getString("name"), if (it.isNull("roll_no")) null else it.optInt("roll_no"),
                    it.str("scholar_no").orEmpty(), Mark.of(it.str("first_half")), Mark.of(it.str("second_half")), it.optBoolean("late"),
                )
            },
        )
    }
}

data class TrendPoint(val dayOn: String, val percentage: Double?)
data class AttendanceInsight(val trend: List<TrendPoint>, val overallPercentage: Double?) {
    companion object {
        fun from(j: JSONObject) = AttendanceInsight(
            trend = j.arr("trend").mapObjects { TrendPoint(it.getString("day_on"), it.dbl("percentage")) },
            overallPercentage = j.dbl("overall_percentage"),
        )
    }
}

// ---- Students

data class StudentItem(
    val id: String, val name: String, val classId: String?, val classLabel: String?, val rollNo: Int?, val scholarNo: String,
    val guardianName: String?, val guardianPhone: String?,
) {
    companion object {
        fun from(j: JSONObject) = StudentItem(
            j.getString("id"), j.getString("name"), j.str("class_id"), j.str("class_label"), if (j.isNull("roll_no")) null else j.optInt("roll_no"),
            j.str("scholar_no").orEmpty(), j.str("guardian_name"), j.str("guardian_phone"),
        )
    }
}

data class Guardian(val name: String, val relation: String, val phone: String?, val isPrimary: Boolean, val occupation: String?)

data class StudentDetail(
    val scholarNo: String, val rollNo: Int?, val gender: String?, val dob: String?, val bloodGroup: String?, val category: String?,
    val address: String?, val admittedOn: String?, val medicalNotes: String?,
    val emergencyName: String?, val emergencyPhone: String?, val guardians: List<Guardian>,
) {
    companion object {
        fun from(j: JSONObject) = StudentDetail(
            scholarNo = j.str("scholar_no").orEmpty(),
            rollNo = j.obj("current_enrollment")?.let { if (it.isNull("roll_no")) null else it.optInt("roll_no") },
            gender = j.str("gender"), dob = j.str("dob"), bloodGroup = j.str("blood_group"), category = j.str("category"),
            address = j.str("address"), admittedOn = j.str("admitted_on"), medicalNotes = j.str("medical_notes"),
            emergencyName = j.str("emergency_name"), emergencyPhone = j.str("emergency_phone"),
            guardians = j.arr("guardians").mapObjects {
                Guardian(it.str("name").orEmpty(), it.str("relation").orEmpty(), it.str("phone"), it.optBoolean("is_primary"), it.str("occupation"))
            },
        )
    }
}

// ---- Leave

data class StaffLeave(
    val id: String, val studentName: String, val classLabel: String?, val fromOn: String, val toOn: String, val half: String,
    val reason: String, val guardianName: String, val status: String, val createdAt: String,
    val decidedByName: String?, val decisionNote: String?,
) {
    companion object {
        fun from(j: JSONObject) = StaffLeave(
            j.getString("id"), j.str("student_name").orEmpty(), j.str("class_label"), j.getString("from_on"), j.getString("to_on"),
            j.str("half") ?: "none", j.str("reason").orEmpty(), j.str("guardian_name").orEmpty(), j.getString("status"),
            j.str("created_at").orEmpty(), j.str("decided_by_name"), j.str("decision_note"),
        )
    }
}

// ---- Timetable

data class DayEntry(
    val role: String, val classLabel: String, val periodName: String, val periodNumber: Int,
    val startsAt: String, val endsAt: String, val subjectName: String, val substituteName: String?,
) {
    companion object {
        fun from(j: JSONObject): DayEntry {
            val s = j.getJSONObject("slot")
            return DayEntry(
                j.str("role").orEmpty(), s.str("class_label").orEmpty(), s.str("period_name").orEmpty(), s.int("period_number"),
                s.str("starts_at").orEmpty(), s.str("ends_at").orEmpty(), s.str("subject_name").orEmpty(), j.str("substitute_name"),
            )
        }
    }
}

// ---- Announcements, staff, fees

/** A notice. [attachments] are its photos (up to five). */
data class Broadcast(
    val id: String, val title: String, val body: String, val createdAt: String, val scope: String,
    val classLabel: String?, val senderName: String, val readCount: Int, val recipientCount: Int,
    val attachments: List<MessageAttachment> = emptyList(),
) {
    /** "Whole school" or "Class 5-A". */
    val audience: String get() = if (scope == "school") "Whole school" else "Class ${classLabel.orEmpty()}"

    companion object {
        fun from(j: JSONObject) = Broadcast(
            j.getString("id"), j.str("title").orEmpty(), j.str("body").orEmpty(), j.str("created_at").orEmpty(), j.str("scope").orEmpty(),
            j.str("class_label"), j.str("sender_name").orEmpty(), j.int("read_count"), j.int("recipient_count"), j.attachments(),
        )
    }
}

data class StaffMember(
    val id: String, val name: String, val email: String, val designation: String, val department: String, val phone: String?,
    val isActive: Boolean, val permissions: List<String>, val inviteStatus: String,
) {
    /** Active, but has not signed in yet: can be sent a login. */
    val notSignedIn: Boolean get() = isActive && inviteStatus != "active"

    companion object {
        fun from(j: JSONObject) = StaffMember(
            j.getString("id"), j.str("name").orEmpty(), j.str("email").orEmpty(), j.str("designation").orEmpty(), j.str("department").orEmpty(),
            j.str("phone"), j.optBoolean("is_active", true), j.strings("permissions"), j.str("invite_status").orEmpty(),
        )
    }
}

data class FeesSummary(
    val billedPaise: Long, val collectedPaise: Long, val collectionPercentage: Double?, val duesPaise: Long, val overduePaise: Long,
    val year: String?, val topDues: List<ClassDues>,
) {
    data class ClassDues(val classLabel: String, val duesPaise: Long, val students: Int)
    companion object {
        fun from(j: JSONObject) = FeesSummary(
            j.optLong("billed_paise"), j.optLong("collected_paise"), j.dbl("collection_percentage"), j.optLong("dues_paise"),
            j.optLong("overdue_paise"), j.str("year"),
            j.arr("top_dues_classes").mapObjects { ClassDues(it.str("class_label").orEmpty(), it.optLong("dues_paise"), it.int("students")) },
        )
    }
}

data class DueRow(
    val studentId: String, val studentName: String, val classLabel: String?, val duePaise: Long, val overduePaise: Long,
    val guardianName: String?, val guardianPhone: String?,
) {
    companion object {
        fun from(j: JSONObject) = DueRow(
            j.getString("student_id"), j.str("student_name").orEmpty(), j.str("class_label"), j.optLong("due_paise"), j.optLong("overdue_paise"),
            j.str("guardian_name"), j.str("guardian_phone"),
        )
    }
}
