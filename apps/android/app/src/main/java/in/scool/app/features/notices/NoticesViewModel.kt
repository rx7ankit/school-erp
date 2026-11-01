package `in`.scool.app.features.notices

import androidx.lifecycle.ViewModel
import `in`.scool.app.app.loadInto
import `in`.scool.app.data.Repository
import `in`.scool.app.domain.CalendarEvent
import `in`.scool.app.domain.ExamSchedule
import `in`.scool.app.domain.Load
import `in`.scool.app.domain.Notice
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
