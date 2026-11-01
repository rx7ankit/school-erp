package `in`.scool.app.domain

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalTime

/** One row of the grid. Times are IST wall-clock times and are never converted. [no] is null for a break. */
data class Period(val index: Int, val no: Int?, val start: LocalTime, val end: LocalTime) {
    val isBreak: Boolean get() = no == null
}

data class TimetableSlot(val day: DayOfWeek, val periodIndex: Int, val subject: String, val teacher: String)

/** A teacher covering a period on [Timetable.substitutionsOn]. */
data class Substitution(val periodIndex: Int, val teacher: String, val subject: String)

data class Timetable(
    val periods: List<Period>,
    /** Monday to Saturday. A missing slot means a free period. */
    val slots: List<TimetableSlot>,
    val substitutionsOn: LocalDate,
    val substitutions: List<Substitution>,
) {
    fun slot(day: DayOfWeek, periodIndex: Int): TimetableSlot? = slots.firstOrNull { it.day == day && it.periodIndex == periodIndex }

    /** Today's cover for a period, only on the day the substitutions are for. */
    fun substitution(date: LocalDate, periodIndex: Int): Substitution? =
        if (date == substitutionsOn) substitutions.firstOrNull { it.periodIndex == periodIndex } else null
}
