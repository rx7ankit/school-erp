package tech.krevo.app.features.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import tech.krevo.app.app.toUiText
import tech.krevo.app.data.Repository
import tech.krevo.app.domain.ExamSummary
import tech.krevo.app.domain.Invoice
import tech.krevo.app.domain.InvoiceStatus
import tech.krevo.app.domain.Load
import tech.krevo.app.domain.Notice
import tech.krevo.app.domain.TodayAttendance
import tech.krevo.app.domain.AttendanceStatus
import tech.krevo.app.domain.Ist
import tech.krevo.app.domain.Period
import tech.krevo.app.domain.Timetable
import java.time.DayOfWeek
import java.time.YearMonth
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate

data class FeesSummary(val duePaise: Long, val nextDueOn: LocalDate?)

/** One cell of the "This week" strip. */
data class WeekDay(val date: LocalDate, val status: AttendanceStatus, val isToday: Boolean, val isFuture: Boolean)

/** One period of today's timetable. [cover] is the substitute teacher when the usual teacher is away. */
data class TodayPeriod(val period: Period, val subject: String, val teacher: String, val cover: String?)

data class HomeData(
    val week: List<WeekDay>,
    val classes: List<TodayPeriod>,
    val today: TodayAttendance,
    val fees: FeesSummary,
    val latestResult: ExamSummary?,
    /** Newest first, at most five. */
    val latestNotices: List<Notice>,
    /** Unread teacher messages for this child, and who the newest one is from. */
    val unreadMessages: Int,
    val unreadFrom: String?,
)

class HomeViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<HomeData>>(Load.Loading)
    val state: StateFlow<Load<HomeData>> = _state.asStateFlow()

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _refreshing.value = true
            try {
                _state.value = Load.Data(fetch())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Keep showing old data on a failed pull-to-refresh.
                if (_state.value !is Load.Data) {
                    _state.value = Load.Error(e.toUiText())
                }
            } finally {
                _refreshing.value = false
            }
        }
    }

    private suspend fun fetch(): HomeData = coroutineScope {
        val today = async { repository.today(childId) }
        val invoices = async { repository.invoices(childId) }
        val exams = async { repository.exams(childId) }
        val notices = async { repository.notices() }
        val week = async { loadWeek() }
        val table = async { runCatching { repository.timetable(childId) }.getOrNull() }
        val threads = async { runCatching { repository.teacherThreads(childId) }.getOrDefault(emptyList()) }
        val unread = threads.await().filter { it.unread > 0 }
        HomeData(
            week = week.await(),
            classes = table.await()?.let(::todaysClasses).orEmpty(),
            today = today.await(),
            fees = summarize(invoices.await()),
            latestResult = exams.await().maxByOrNull { it.publishedAt },
            latestNotices = notices.await().sortedByDescending { it.publishedAt }.take(5),
            unreadMessages = unread.sumOf { it.unread },
            unreadFrom = unread.maxByOrNull { it.lastAt }?.teacher,
        )
    }

    /** Monday to Saturday of this week with each day's attendance. Looks up every month the week touches. */
    private suspend fun loadWeek(): List<WeekDay> {
        val today = Ist.today()
        val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())
        val days = (0..5).map { monday.plusDays(it.toLong()) }
        val byDate = HashMap<LocalDate, AttendanceStatus>()
        for (month in days.map { YearMonth.from(it) }.distinct()) {
            repository.attendanceMonth(childId, month.toString()).days.forEach { byDate[it.date] = it.status }
        }
        return days.map { WeekDay(it, byDate[it] ?: AttendanceStatus.NOT_MARKED, it == today, it.isAfter(today)) }
    }

    /** Today's periods in order. Sunday has none. */
    private fun todaysClasses(t: Timetable): List<TodayPeriod> {
        val today = Ist.today()
        if (today.dayOfWeek == DayOfWeek.SUNDAY) return emptyList()
        return t.periods.filter { !it.isBreak }.mapNotNull { p ->
            val slot = t.slot(today.dayOfWeek, p.index) ?: return@mapNotNull null
            TodayPeriod(p, slot.subject, slot.teacher, t.substitution(today, p.index)?.teacher)
        }
    }

    private fun summarize(invoices: List<Invoice>): FeesSummary {
        val open = invoices.filter { it.status != InvoiceStatus.PAID }
        return FeesSummary(
            duePaise = open.sumOf { it.balancePaise },
            nextDueOn = open.minOfOrNull { it.dueOn },
        )
    }
}
