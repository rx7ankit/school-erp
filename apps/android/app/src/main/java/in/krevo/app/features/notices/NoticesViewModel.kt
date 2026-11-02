package `in`.krevo.app.features.notices

import androidx.lifecycle.ViewModel
import `in`.krevo.app.app.loadInto
import `in`.krevo.app.data.Repository
import `in`.krevo.app.domain.CalendarEvent
import `in`.krevo.app.domain.ExamSchedule
import `in`.krevo.app.domain.Load
import `in`.krevo.app.domain.Notice
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class NoticesData(val notices: List<Notice>, val events: List<CalendarEvent>, val schedules: List<ExamSchedule>)

class NoticesViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<NoticesData>>(Load.Loading)
    val state: StateFlow<Load<NoticesData>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = Load.Loading
        loadInto(_state) {
            coroutineScope {
                val n = async { repository.notices() }
                val e = async { repository.calendar() }
                val s = async { repository.examSchedules(childId) }
                NoticesData(n.await(), e.await(), s.await())
            }
        }
    }
}
