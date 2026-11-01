package `in`.scool.app.features.timetable

import androidx.lifecycle.ViewModel
import `in`.scool.app.app.loadInto
import `in`.scool.app.data.Repository
import `in`.scool.app.domain.Load
import `in`.scool.app.domain.Timetable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class TimetableViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<Timetable>>(Load.Loading)
    val state: StateFlow<Load<Timetable>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = Load.Loading
        loadInto(_state) { repository.timetable(childId) }
    }
}
