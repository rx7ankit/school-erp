package tech.slov.app.features.results

import androidx.lifecycle.ViewModel
import tech.slov.app.app.loadInto
import tech.slov.app.data.Repository
import tech.slov.app.domain.ExamDetail
import tech.slov.app.domain.ExamSummary
import tech.slov.app.domain.Load
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class ResultsViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<List<ExamSummary>>>(Load.Loading)
    val state: StateFlow<Load<List<ExamSummary>>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = Load.Loading
        loadInto(_state) { repository.exams(childId) }
    }
}

class ResultDetailViewModel(private val repository: Repository, private val examId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<ExamDetail>>(Load.Loading)
    val state: StateFlow<Load<ExamDetail>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = Load.Loading
        loadInto(_state) { repository.examDetail(examId) }
    }
}
