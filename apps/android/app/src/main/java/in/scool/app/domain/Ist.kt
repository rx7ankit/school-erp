package `in`.scool.app.domain

import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * The single place dates and times become text.
 * - `*_at` values are UTC ISO-8601 strings and are always shown in IST (Asia/Kolkata), never the device zone.
 * - `*_on` values are plain school dates ([LocalDate]) and are never zone-shifted.
 */
object Ist {
    val zone: ZoneId = ZoneId.of("Asia/Kolkata")

    private val dateTimeFmt = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.ENGLISH).withZone(zone)
    private val timeFmt = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH).withZone(zone)
    private val dateFmt = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)
    private val shortDateFmt = DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH)
    private val longDateFmt = DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.ENGLISH)
    private val monthFmt = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH)

    private fun lower(s: String) = s.replace("AM", "am").replace("PM", "pm")

    /** UTC ISO string -> "31 Oct 2026, 2:50 pm" (IST). */
    fun dateTime(utcIso: String): String = lower(dateTimeFmt.format(Instant.parse(utcIso)))

    /** UTC ISO string -> "2:50 pm" (IST). */
    fun time(utcIso: String): String = lower(timeFmt.format(Instant.parse(utcIso)))

    /** UTC ISO string -> "31 Oct 2026" (IST calendar day). */
    fun dateOfInstant(utcIso: String): String = dateFmt.format(Instant.parse(utcIso).atZone(zone))

    /** Date-only -> "10 Nov 2026". No zone involved. */
    fun date(d: LocalDate): String = dateFmt.format(d)

    /** Date-only -> "Sunday, 1 November". */
    fun longDate(d: LocalDate): String = longDateFmt.format(d)

    /** Date-only range -> "8 Nov - 12 Nov 2026" or a single date. */
    fun range(from: LocalDate, to: LocalDate): String =
        if (from == to) date(from) else "${shortDateFmt.format(from)} - ${date(to)}"

    /** Year-month -> "November 2026". */
    fun month(m: YearMonth): String = monthFmt.format(m)

    /** Today's school date in IST. */
    fun today(): LocalDate = LocalDate.now(zone)

    /** Current instant as a UTC ISO string, for timestamps we create. */
    fun nowUtc(): String = Instant.now().toString()

    /** Hour of day (0-23) in IST, for greetings. */
    fun hourNow(): Int = Instant.now().atZone(zone).hour
}
