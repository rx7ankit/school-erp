package `in`.krevo.app.domain

import java.time.LocalDate

enum class UserKind { PARENT, STAFF }

data class User(
    val id: String,
    val name: String,
    val kind: UserKind,
    val mustChangePassword: Boolean,
)

enum class ChildStatus { ACTIVE, LEFT }

data class Child(
    val id: String,
    val name: String,
    val className: String,
    val rollNo: Int,
    val scholarNo: String,
    val dob: LocalDate,
    val guardians: List<String>,
    val status: ChildStatus,
    /** School date the child left (date-only, never zone-shifted). */
    val leftOn: LocalDate? = null,
) {
    val firstName: String get() = name.substringBefore(' ')
    val isActive: Boolean get() = status == ChildStatus.ACTIVE
    val initials: String
        get() = name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1).uppercase() }
}

data class Notice(
    val id: String,
    val title: String,
    val body: String,
    /** UTC ISO-8601 string. */
    val publishedAt: String,
)

enum class EventKind { HOLIDAY, EXAM, EVENT }

data class CalendarEvent(
    val id: String,
    val title: String,
    val fromOn: LocalDate,
    val toOn: LocalDate,
    val kind: EventKind,
)

fun initialsOf(name: String): String =
    name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1).uppercase() }
