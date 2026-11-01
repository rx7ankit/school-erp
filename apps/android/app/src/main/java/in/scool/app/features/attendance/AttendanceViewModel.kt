package `in`.scool.app.features.attendance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import `in`.scool.app.data.Repository
import `in`.scool.app.domain.AttendanceMonth
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.Load
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.YearMonth

class AttendanceViewModel(
    private val repository: Repository,
    private val childId: String,
) : ViewModel() {
    private val currentMonth: YearMonth = YearMonth.from(Ist.today())

    private val _month = MutableStateFlow(currentMonth)
    val month: StateFlow<YearMonth> = _month.asStateFlow()

    private val _state = MutableStateFlow<Load<AttendanceMonth>>(Load.Loading)
    val state: StateFlow<Load<AttendanceMonth>> = _state.asStateFlow()

    private var job: Job? = null

    init {
        load()
    }

    val canGoNext: Boolean get() = _month.value.isBefore(currentMonth)

    fun previous() {
        _month.value = _month.value.minusMonths(1)
        load()
    }

    fun next() {
        if (!canGoNext) return
        _month.value = _month.value.plusMonths(1)
        load()
    }

    fun load() {
        job?.cancel()
        _state.value = Load.Loading
        val requested = _month.value
        job = viewModelScope.launch {
            try {
                _state.value = Load.Data(repository.attendanceMonth(childId, requested.toString()))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.value = Load.Error(e.message ?: "Something went wrong. Please try again.")
            }
        }
    }
}
