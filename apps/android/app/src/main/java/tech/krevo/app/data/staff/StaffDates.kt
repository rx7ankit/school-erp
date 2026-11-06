package tech.krevo.app.data.staff

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** School dates are plain "yyyy-MM-dd" strings in Asia/Kolkata; nothing here shifts a date between zones. */
object StaffDates {
    private val ist = ZoneId.of("Asia/Kolkata")
    private val long = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)
    private val short = DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH)
    private val dateTime = DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.ENGLISH)

    fun today(): String = LocalDate.now(ist).toString()
    /** The time now in school hours, as "HH:mm" (the same shape as a period's start, so the two compare as text). */
    fun nowHm(): String = LocalTime.now(ist).format(DateTimeFormatter.ofPattern("HH:mm"))
    /** A date picker works in UTC milliseconds at midnight; a school date is just the calendar day. */
    fun toPickerMillis(on: String): Long = LocalDate.parse(on).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    fun fromPickerMillis(millis: Long): String = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate().toString()
    fun addDays(on: String, days: Int): String = LocalDate.parse(on).plusDays(days.toLong()).toString()
    fun date(on: String): String = runCatching { LocalDate.parse(on).format(long) }.getOrDefault(on)
    fun shortDate(on: String): String = runCatching { LocalDate.parse(on).format(short) }.getOrDefault(on)
    fun range(from: String, to: String): String = if (from == to) date(from) else shortDate(from) + " - " + date(to)
    fun weekday(on: String): String =
        runCatching { LocalDate.parse(on).dayOfWeek.getDisplayName(TextStyle.FULL, Locale.ENGLISH) }.getOrDefault("")
    fun weekdayShort(on: String): String = weekday(on).take(3)
    fun isSunday(on: String): Boolean = runCatching { LocalDate.parse(on).dayOfWeek == DayOfWeek.SUNDAY }.getOrDefault(false)

    /** Monday to Saturday of the week that contains today. */
    fun schoolWeek(): List<String> {
        val t = LocalDate.parse(today())
        val monday = t.minusDays(((t.dayOfWeek.value + 6) % 7).toLong())
        return (0..5).map { monday.plusDays(it.toLong()).toString() }
    }

    /** "2026-11-05T01:27:12.8Z" as "5 Nov 2026, 6:57 AM" in IST. */
    fun instant(iso: String): String = runCatching { Instant.parse(iso).atZone(ist).format(dateTime) }.getOrDefault(iso)

    /** "08:40:00" as "8:40 am". */
    fun clock(hhmmss: String): String {
        val p = hhmmss.split(":")
        val h = p.getOrNull(0)?.toIntOrNull() ?: return hhmmss
        val h12 = if (h % 12 == 0) 12 else h % 12
        return "$h12:${p.getOrElse(1) { "00" }} ${if (h < 12) "am" else "pm"}"
    }
}
