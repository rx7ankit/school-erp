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
 * - Month and weekday names follow [locale] (English or Hindi). Digits are always Latin (0-9).
 */
object Ist {
    val zone: ZoneId = ZoneId.of("Asia/Kolkata")

    /** Set by the activity from the active app language. */
    @Volatile
    var locale: Locale = Locale.ENGLISH

    private val cache = ConcurrentHashMap<String, DateTimeFormatter>()

    private fun fmt(pattern: String, l: Locale = locale): DateTimeFormatter {
        return cache.getOrPut(l.toLanguageTag() + "|" + pattern) {
            DateTimeFormatter.ofPattern(pattern, l).withDecimalStyle(DecimalStyle.STANDARD)
        }
    }

    /** Hindi spells months in full ("1 नवंबर 2026"); English uses the short name. */
    private fun mon(l: Locale = locale): String = if (l.language == "hi") "MMMM" else "MMM"

    private fun at(utcIso: String): ZonedDateTime = Instant.parse(utcIso).atZone(zone)

    /** UTC ISO string -> "31 Oct 2026, 2:50 pm" (IST). Pass [l] = Locale.ENGLISH for English-only output such as the receipt PDF. */
    fun dateTime(utcIso: String, l: Locale = locale): String = dateOfInstant(utcIso, l) + ", " + time(utcIso, l)

    /** UTC ISO string -> "2:50 pm" (IST). am/pm stay Latin in both languages. */
    fun time(utcIso: String, l: Locale = locale): String {
        val z = at(utcIso)
        return fmt("h:mm", l).format(z) + if (z.hour < 12) " am" else " pm"
    }

    /** UTC ISO string -> "31 Oct 2026" (IST calendar day). */
    fun dateOfInstant(utcIso: String, l: Locale = locale): String = fmt("d ${mon(l)} yyyy", l).format(at(utcIso))

    /** UTC ISO string -> "Monday" (IST calendar day). */
    fun weekdayOfInstant(utcIso: String): String = fmt("EEEE").format(at(utcIso))

    /** Date-only -> "10 Nov 2026". No zone involved. */
    fun date(d: LocalDate): String = fmt("d ${mon()} yyyy").format(d)

    /** Date-only -> "Sunday, 1 November". */
    fun longDate(d: LocalDate): String = fmt("EEEE, d MMMM").format(d)

    /** Date-only range -> "8 Nov - 12 Nov 2026" or a single date. */
    fun range(from: LocalDate, to: LocalDate): String =
        if (from == to) date(from) else "${fmt("d ${mon()}").format(from)} - ${date(to)}"

    /** Year-month -> "November 2026". */
    fun month(m: YearMonth): String = fmt("MMMM yyyy").format(m)

    /** One-letter weekday for the calendar header. */
    fun narrowWeekday(d: DayOfWeek): String = d.getDisplayName(TextStyle.NARROW, locale)

    /** Today's school date in IST. */
    fun today(): LocalDate = LocalDate.now(zone)

    /** Current instant as a UTC ISO string, for timestamps we create. */
    fun nowUtc(): String = Instant.now().toString()

    /** Hour of day (0-23) in IST, for greetings. */
    fun hourNow(): Int = Instant.now().atZone(zone).hour
}
