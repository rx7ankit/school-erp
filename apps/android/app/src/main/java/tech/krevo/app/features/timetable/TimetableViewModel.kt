package tech.krevo.app.features.timetable

import androidx.lifecycle.ViewModel
import tech.krevo.app.app.loadInto
import tech.krevo.app.data.Repository
import tech.krevo.app.domain.Load
import tech.krevo.app.domain.Timetable
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
