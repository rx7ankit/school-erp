package `in`.scool.app.domain

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DecimalStyle
import java.time.format.TextStyle
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

/**
 * The single place dates and times become text.
 * - `*_at` values are UTC ISO-8601 strings and are always shown in IST (Asia/Kolkata), never the device zone.
 * - `*_on` values are plain school dates ([LocalDate]) and are never zone-shifted.
 * - Month and weekday names are English (Locale en-IN). Digits are Latin (0-9).
 */
object Ist {
    val zone: ZoneId = ZoneId.of("Asia/Kolkata")

    val locale: Locale = Locale.forLanguageTag("en-IN")

    private val cache = ConcurrentHashMap<String, DateTimeFormatter>()

    private fun fmt(pattern: String): DateTimeFormatter =
        cache.getOrPut(pattern) { DateTimeFormatter.ofPattern(pattern, locale).withDecimalStyle(DecimalStyle.STANDARD) }

    private fun at(utcIso: String): ZonedDateTime = Instant.parse(utcIso).atZone(zone)

    /** UTC ISO string -> "31 Oct 2026, 2:50 pm" (IST). */
    fun dateTime(utcIso: String): String = dateOfInstant(utcIso) + ", " + time(utcIso)

    /** UTC ISO string -> "2:50 pm" (IST). */
    fun time(utcIso: String): String {
        val z = at(utcIso)
        return fmt("h:mm").format(z) + if (z.hour < 12) " am" else " pm"
    }

    /** UTC ISO string -> "31 Oct 2026" (IST calendar day). */
    fun dateOfInstant(utcIso: String): String = fmt("d MMM yyyy").format(at(utcIso))

    /** UTC ISO string -> "Monday" (IST calendar day). */
    fun weekdayOfInstant(utcIso: String): String = fmt("EEEE").format(at(utcIso))

    /** Date-only -> "10 Nov 2026". No zone involved. */
    fun date(d: LocalDate): String = fmt("d MMM yyyy").format(d)

    /** Date-only -> "Sunday, 1 November". */
    fun longDate(d: LocalDate): String = fmt("EEEE, d MMMM").format(d)

    /** Date-only range -> "8 Nov - 12 Nov 2026" or a single date. */
    fun range(from: LocalDate, to: LocalDate): String =
        if (from == to) date(from) else "${fmt("d MMM").format(from)} - ${date(to)}"

    /** Year-month -> "November 2026". */
    fun month(m: YearMonth): String = fmt("MMMM yyyy").format(m)

    /** Clock time of a timetable period -> "9:40 am". No zone involved: it is already school time. */
    fun clock(t: java.time.LocalTime): String = fmt("h:mm").format(t) + if (t.hour < 12) " am" else " pm"

    /** "Mon" or "Monday". */
    fun dayName(d: DayOfWeek, full: Boolean = false): String =
        d.getDisplayName(if (full) TextStyle.FULL else TextStyle.SHORT, locale)

    /** Date picker value (UTC midnight millis of the picked calendar day) -> that school date, with no zone shift. */
    fun fromPickerMillis(ms: Long): LocalDate = Instant.ofEpochMilli(ms).atZone(java.time.ZoneOffset.UTC).toLocalDate()

    /** School date -> value for a date picker. */
    fun toPickerMillis(d: LocalDate): Long = d.atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()

    /** One-letter weekday for the calendar header. */
    fun narrowWeekday(d: DayOfWeek): String = d.getDisplayName(TextStyle.NARROW, locale)

    /** Whole IST calendar days from the day of [utcIso] to today (0 = today). */
    fun daysSince(utcIso: String): Long = java.time.temporal.ChronoUnit.DAYS.between(at(utcIso).toLocalDate(), today())

    /** Today's school date in IST. */
    fun today(): LocalDate = LocalDate.now(zone)

    /** Current instant as a UTC ISO string, for timestamps we create. */
    fun nowUtc(): String = Instant.now().toString()

    /** Hour of day (0-23) in IST, for greetings. */
    fun hourNow(): Int = Instant.now().atZone(zone).hour
}
