package tech.krevo.app.data.staff

/** Pure helpers for the People & access screens: the switches and the one-line summary. */
object AccessEditing {
    /** Only the five known permissions count (the API may also list the retired `staff.manage`). */
    fun known(permissions: Collection<String>): Set<String> = permissions.filter { it in Permission.ALL }.toSet()

    fun toggle(selected: Set<String>, key: String, on: Boolean): Set<String> = if (on) selected + key else selected - key

    /** "Principal · Full access", "Teacher · Fees", or just the designation for someone with no extra access. */
    fun summary(designation: String, permissions: Collection<String>): String {
        val held = known(permissions)
        val access = when {
            held.size == Permission.ALL.size -> "Full access"
            held.isEmpty() -> ""
            else -> held.sorted().joinToString(", ") { it.removeSuffix(".manage").replaceFirstChar { c -> c.uppercase() } }
        }
        return listOf(designation, access).filter { it.isNotEmpty() }.joinToString(" · ")
    }
}

/** The subject to open a parent conversation under: null when I am the class teacher of the child's class. */
fun threadSubjectId(assignments: List<StaffAssignment>, classId: String?): String? {
    val mine = assignments.filter { it.classId == classId }
    if (mine.any { it.role == "class_teacher" }) return null
    return mine.firstNotNullOfOrNull { it.subjectId }
}

/** A class's team: the class teacher, and each of the class's subjects with its teacher. */
data class ClassTeam(val classTeacher: String?, val subjects: List<Pair<String, String?>>)

fun classTeam(assignments: List<AssignmentRow>, subjects: List<Subject>, subjectIds: List<String>): ClassTeam {
    val names = subjects.associate { it.id to it.name }
    return ClassTeam(
        classTeacher = assignments.firstOrNull { it.role == "class_teacher" }?.staffName,
        subjects = subjectIds.mapNotNull { id -> names[id]?.let { it to assignments.firstOrNull { a -> a.subjectId == id }?.staffName } }.sortedBy { it.first },
    )
}
