package tech.krevo.app.data

import tech.krevo.app.domain.CalendarEvent
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.ChildStatus
import tech.krevo.app.domain.EventKind
import tech.krevo.app.domain.Notice
import java.time.LocalDate

/** Demo content for Rewa Public School. Shapes follow apps/web/src/lib/mock.ts. */
internal object MockData {
    val aarav = Child(
        id = "st1", name = "Aarav Tiwari", className = "8-B", rollNo = 1, scholarNo = "RPS2001",
        dob = LocalDate.of(2012, 3, 14), guardians = listOf("Rakesh Tiwari", "Sunita Tiwari"),
        status = ChildStatus.ACTIVE,
    )
    val diya = Child(
        id = "st2", name = "Diya Tiwari", className = "7-A", rollNo = 1, scholarNo = "RPS2004",
        dob = LocalDate.of(2014, 8, 2), guardians = listOf("Rakesh Tiwari", "Sunita Tiwari"),
        status = ChildStatus.ACTIVE,
    )
    val riya = Child(
        id = "st3", name = "Riya Tiwari", className = "9-A", rollNo = 2, scholarNo = "RPS2008",
        dob = LocalDate.of(2011, 1, 21), guardians = listOf("Rakesh Tiwari", "Sunita Tiwari"),
        status = ChildStatus.LEFT, leftOn = LocalDate.of(2026, 9, 30),
    )
    val allChildren = listOf(aarav, diya, riya)

    fun child(id: String): Child = allChildren.first { it.id == id }

    val notices = listOf(
        Notice("n1", "Diwali holidays announced",
            "School will remain closed from 8 to 12 November. Classes resume on 13 November.", "2026-10-30T05:00:00Z"),
        Notice("n2", "Half-yearly exam timetable",
            "The timetable has been shared with class teachers. Parents will receive it in the app.", "2026-10-28T08:30:00Z"),
        Notice("n4", "Term 2 fees due on 10 November",
            "Fees are paid at the school office. The app shows invoices and receipts only.", "2026-10-25T06:00:00Z"),
    )

    val calendar = listOf(
        CalendarEvent("h1", "Diwali Break", LocalDate.of(2026, 11, 8), LocalDate.of(2026, 11, 12), EventKind.HOLIDAY),
        CalendarEvent("h5", "Parent-teacher meeting", LocalDate.of(2026, 11, 21), LocalDate.of(2026, 11, 21), EventKind.EVENT),
        CalendarEvent("h2", "Half-yearly Exams", LocalDate.of(2026, 11, 23), LocalDate.of(2026, 12, 4), EventKind.EXAM),
        CalendarEvent("h3", "Annual Sports Day", LocalDate.of(2026, 12, 12), LocalDate.of(2026, 12, 12), EventKind.EVENT),
        CalendarEvent("h4", "Winter Break", LocalDate.of(2026, 12, 25), LocalDate.of(2027, 1, 3), EventKind.HOLIDAY),
    )

    /** School holidays that block attendance (date-only). */
    fun isHoliday(d: LocalDate): Boolean =
        d.dayOfWeek == java.time.DayOfWeek.SUNDAY ||
            calendar.any { it.kind == EventKind.HOLIDAY && !d.isBefore(it.fromOn) && !d.isAfter(it.toOn) }

    class Teacher(val name: String, val subject: String, val isClassTeacher: Boolean)

    fun teachers(className: String): List<Teacher> = when (className) {
        "8-B" -> listOf(
            Teacher("Rajiv Mishra", "Mathematics", true),
            Teacher("Sunita Dwivedi", "English", false),
            Teacher("Farhan Khan", "Science", false),
        )
        "7-A" -> listOf(
            Teacher("Sunita Dwivedi", "English", true),
            Teacher("Pooja Singh", "Hindi", false),
            Teacher("Rajiv Mishra", "Mathematics", false),
        )
        else -> listOf(
            Teacher("Dinesh Gupta", "Social Science", true),
            Teacher("Rajiv Mishra", "Mathematics", false),
        )
    }

    val subjects = listOf("Mathematics", "English", "Hindi", "Science", "Social Science")
}
