package tech.slov.app.domain

/** SCHOOL = from the principal or academic team to the whole school (or chosen classes); CLASS = from a teacher of the child's class. */
enum class UpdateKind { SCHOOL, CLASS }

/**
 * One item of the Updates feed. Parents cannot reply here.
 * The tag shown is "School" for [UpdateKind.SCHOOL], otherwise [subject] (null = "General").
 */
data class Update(
    val id: String,
    val kind: UpdateKind,
    val sender: String,
    val subject: String?,
    val text: String,
    val attachment: String?,
    /** UTC ISO-8601 string. */
    val at: String,
    val read: Boolean,
)

enum class ThreadStatus { ACTIVE, INACTIVE }

/**
 * A private thread between the parent and one teacher for one subject. It is [ThreadStatus.INACTIVE] when that teacher
 * is no longer assigned to the child's class: still readable, but no replies.
 */
data class TeacherThread(
    val id: String,
    val teacher: String,
    val subject: String,
    val isClassTeacher: Boolean,
    val status: ThreadStatus,
    val lastMessage: String,
    /** UTC ISO-8601 string. */
    val lastAt: String,
    val unread: Int,
) {
    val isActive: Boolean get() = status == ThreadStatus.ACTIVE
}

data class ThreadMessage(
    val id: String,
    val mine: Boolean,
    val from: String,
    val body: String,
    /** UTC ISO-8601 string. */
    val at: String,
)
