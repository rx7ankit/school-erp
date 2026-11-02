package `in`.krevo.app.features.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import `in`.krevo.app.app.toUiText
import `in`.krevo.app.data.Repository
import `in`.krevo.app.domain.ExamSummary
import `in`.krevo.app.domain.Invoice
import `in`.krevo.app.domain.InvoiceStatus
import `in`.krevo.app.domain.Load
import `in`.krevo.app.domain.Notice
import `in`.krevo.app.domain.TodayAttendance
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate

data class FeesSummary(val duePaise: Long, val nextDueOn: LocalDate?)

data class HomeData(
    val today: TodayAttendance,
    val fees: FeesSummary,
    val latestResult: ExamSummary?,
    val latestNotice: Notice?,
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
        HomeData(
            today = today.await(),
            fees = summarize(invoices.await()),
            latestResult = exams.await().maxByOrNull { it.publishedAt },
            latestNotice = notices.await().maxByOrNull { it.publishedAt },
        )
    }

    private fun summarize(invoices: List<Invoice>): FeesSummary {
        val open = invoices.filter { it.status != InvoiceStatus.PAID }
        return FeesSummary(
            duePaise = open.sumOf { it.balancePaise },
            nextDueOn = open.minOfOrNull { it.dueOn },
        )
    }
}
