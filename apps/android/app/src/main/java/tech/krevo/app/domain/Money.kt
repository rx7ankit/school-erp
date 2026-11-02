package tech.krevo.app.domain

import kotlin.math.abs

/**
 * Money is integer paise everywhere. This is the only place it becomes text.
 * Same output in English and Hindi: the ₹ sign, Latin digits and Indian grouping (the en-IN and hi-IN convention).
 * Grouping is done by hand so it never depends on the device's ICU data.
 */
object Money {
    /** 1850000 -> "₹18,500". Fractions only when present: 1850050 -> "₹18,500.50". */
    fun format(paise: Long): String {
        val sign = if (paise < 0) "-" else ""
        val rupees = abs(paise) / 100
        val rest = abs(paise) % 100
        val fraction = if (rest == 0L) "" else "." + rest.toString().padStart(2, '0')
        return "$sign₹${group(rupees)}$fraction"
    }

    /** Indian grouping: 12,34,567. */
    private fun group(n: Long): String {
        val s = n.toString()
        if (s.length <= 3) return s
        val head = s.substring(0, s.length - 3)
        val tail = s.substring(s.length - 3)
        val parts = ArrayList<String>()
        var i = head.length
        while (i > 0) {
            parts.add(0, head.substring(maxOf(0, i - 2), i))
            i -= 2
        }
        return parts.joinToString(",") + "," + tail
    }
}
