package tech.krevo.app.features.fees

import androidx.lifecycle.ViewModel
import tech.krevo.app.app.loadInto
import tech.krevo.app.data.Repository
import tech.krevo.app.domain.Invoice
import tech.krevo.app.domain.Load
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
