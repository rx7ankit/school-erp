package tech.krevo.app.data.staff

import org.json.JSONObject
import tech.krevo.app.data.arr
import tech.krevo.app.data.dbl
import tech.krevo.app.data.int
import tech.krevo.app.data.mapObjects
import tech.krevo.app.data.obj
import tech.krevo.app.data.str

// Staff-side models. They mirror the JSON of the Krevo API. `*_on` values are plain school dates ("2026-11-05"),
// `*_at` values are UTC instants; both stay strings. Parsed with the null-safe helpers in ApiClient.kt.

data class StaffAssignment(val classId: String, val role: String, val subjectId: String?)

data class StaffMe(
    val id: String, val name: String, val email: String, val isAdmin: Boolean, val designation: String?,
    val permissions: List<String>, val assignments: List<StaffAssignment>, val schoolName: String?,
) {
    val roleTitle: String get() = if (isAdmin) "Admin" else (designation?.takeIf { it.isNotBlank() } ?: "Teacher")
    val canSeeFees: Boolean get() = isAdmin || "fees.manage" in permissions
    val canSeeStaff: Boolean get() = isAdmin || "staff.manage" in permissions
    /** Class teacher of at least one class (or admin): may mark attendance and decide leave. */
    val canMarkAttendance: Boolean get() = isAdmin || assignments.any { it.role == "class_teacher" }
    fun markableClassIds(all: List<String>): Set<String> =
        if (isAdmin) all.toSet() else assignments.filter { it.role == "class_teacher" }.map { it.classId }.toSet()

    companion object {
        fun from(j: JSONObject): StaffMe {
            val perms = j.arr("permissions")
            return StaffMe(
                id = j.getString("id"), name = j.getString("name"), email = j.str("email").orEmpty(),
                isAdmin = j.optBoolean("is_admin"), designation = j.str("designation"),
                permissions = (0 until perms.length()).map { perms.getString(it) },
                assignments = j.arr("assignments").mapObjects { StaffAssignment(it.getString("class_id"), it.getString("role"), it.str("subject_id")) },
                schoolName = j.obj("school")?.str("name"),
            )
        }
    }
}

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

data class StaffClass(val id: String, val grade: String, val section: String, val students: Int) {
    val label: String get() = if (section.isEmpty()) grade else "$grade-$section"
    companion object {
        fun from(j: JSONObject) = StaffClass(j.getString("id"), j.getString("grade"), j.str("section").orEmpty(), j.int("students"))
    }
}

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
    val id: String, val name: String, val classLabel: String?, val rollNo: Int?, val scholarNo: String,
    val guardianName: String?, val guardianPhone: String?,
) {
    companion object {
        fun from(j: JSONObject) = StudentItem(
            j.getString("id"), j.getString("name"), j.str("class_label"), if (j.isNull("roll_no")) null else j.optInt("roll_no"),
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

data class Broadcast(
    val id: String, val title: String, val body: String, val createdAt: String, val scope: String,
    val classLabel: String?, val senderName: String, val readCount: Int, val recipientCount: Int,
) {
    companion object {
        fun from(j: JSONObject) = Broadcast(
            j.getString("id"), j.str("title").orEmpty(), j.str("body").orEmpty(), j.str("created_at").orEmpty(), j.str("scope").orEmpty(),
            j.str("class_label"), j.str("sender_name").orEmpty(), j.int("read_count"), j.int("recipient_count"),
        )
    }
}

data class StaffMember(val id: String, val name: String, val designation: String, val department: String, val phone: String?, val isAdmin: Boolean) {
    companion object {
        fun from(j: JSONObject) = StaffMember(
            j.getString("id"), j.str("name").orEmpty(), j.str("designation").orEmpty(), j.str("department").orEmpty(), j.str("phone"), j.optBoolean("is_admin"),
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
