package `in`.scool.app.domain

/** Indian-system amount in words, English only (used on fee receipts). */
object AmountInWords {
    private val small = listOf(
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
        "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
    )
    private val tens = listOf("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")

    private fun below100(n: Int): String =
        if (n < 20) small[n] else tens[n / 10] + if (n % 10 != 0) " " + small[n % 10] else ""

    private fun below1000(n: Int): String {
        val h = n / 100
        val r = n % 100
        return listOf(
            if (h > 0) small[h] + " Hundred" else "",
            below100(r),
        ).filter { it.isNotEmpty() }.joinToString(" ")
    }

    private fun rupeesInWords(n: Long): String {
        if (n == 0L) return "Zero"
        var rest = n
        val parts = ArrayList<String>()
        val crore = rest / 10_000_000; rest %= 10_000_000
        val lakh = rest / 100_000; rest %= 100_000
        val thousand = rest / 1_000; rest %= 1_000
        if (crore > 0) parts.add(rupeesInWords(crore) + " Crore")
        if (lakh > 0) parts.add(below100(lakh.toInt()) + " Lakh")
        if (thousand > 0) parts.add(below100(thousand.toInt()) + " Thousand")
        if (rest > 0) parts.add(below1000(rest.toInt()))
        return parts.joinToString(" ")
    }

    /** 1850000 -> "Rupees Eighteen Thousand Five Hundred Only". */
    fun of(paise: Long): String {
        val rupees = paise / 100
        val rest = (paise % 100).toInt()
        val paiseWords = if (rest > 0) " and " + below100(rest) + " Paise" else ""
        return "Rupees " + rupeesInWords(rupees) + paiseWords + " Only"
    }
}
