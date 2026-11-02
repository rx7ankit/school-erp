package tech.slov.app.features.timetable

import androidx.lifecycle.ViewModel
import tech.slov.app.app.loadInto
import tech.slov.app.data.Repository
import tech.slov.app.domain.Load
import tech.slov.app.domain.Timetable
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
