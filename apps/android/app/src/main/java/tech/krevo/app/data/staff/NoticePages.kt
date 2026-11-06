package tech.krevo.app.data.staff

/** The notices loaded so far, a page at a time (20 per request, newest first). */
data class NoticePages(val items: List<Broadcast> = emptyList(), val total: Int = 0) {
    /** Where the next request starts. */
    val nextOffset: Int get() = items.size
    val hasMore: Boolean get() = items.size < total

    /** These pages followed by [page]; a notice that arrived twice (a new one pushed the list down) is kept once. */
    fun appended(page: Page<Broadcast>): NoticePages =
        NoticePages(items + page.items.filter { n -> items.none { it.id == n.id } }, page.total)
}
