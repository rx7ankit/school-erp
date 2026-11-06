package tech.krevo.app.data.staff

/** Where a period of today stands, shown as a chip on its card. */
enum class PeriodStatus { COVER, NOW, NEXT, DONE, LATER }

/**
 * Today's periods in time order, each with its status at [nowHm] ("HH:mm", school time). A period someone covers is
 * always Cover; otherwise Now while it runs, Next for the first one still to come, Done once it has ended.
 */
fun periodStatuses(entries: List<DayEntry>, nowHm: String): List<Pair<DayEntry, PeriodStatus>> {
    val sorted = entries.sortedBy { it.startsAt }
    val next = sorted.firstOrNull { it.startsAt.take(5) > nowHm }
    return sorted.map { e ->
        val start = e.startsAt.take(5)
        val end = e.endsAt.take(5)
        e to when {
            e.substituteName != null -> PeriodStatus.COVER
            start <= nowHm && nowHm < end -> PeriodStatus.NOW
            e === next -> PeriodStatus.NEXT
            end <= nowHm -> PeriodStatus.DONE
            else -> PeriodStatus.LATER
        }
    }
}

/** The period to show as "my next class": the one running now, else the first still to come. */
fun nextPeriod(entries: List<DayEntry>, nowHm: String): DayEntry? =
    entries.sortedBy { it.startsAt }.firstOrNull { it.endsAt.take(5) > nowHm }
