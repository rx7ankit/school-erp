package `in`.scool.app.features.fees

import androidx.lifecycle.ViewModel
import `in`.scool.app.app.loadInto
import `in`.scool.app.data.Repository
import `in`.scool.app.domain.Invoice
import `in`.scool.app.domain.Load
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Loads all invoices for a child. The list screen and the detail screen both use it. */
class FeesViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<List<Invoice>>>(Load.Loading)
    val state: StateFlow<Load<List<Invoice>>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = Load.Loading
        loadInto(_state) { repository.invoices(childId) }
    }
}
