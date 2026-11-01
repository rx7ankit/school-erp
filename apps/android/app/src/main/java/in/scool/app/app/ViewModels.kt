package `in`.scool.app.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import `in`.scool.app.domain.Load
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

/** Tiny factory so view models can take constructor arguments without a DI library. */
class VmFactory<T : ViewModel>(private val make: () -> T) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <V : ViewModel> create(modelClass: Class<V>): V = make() as V
}

/** Runs [block] and publishes Data or Error into [target]. Keeps the old data visible while refreshing. */
fun <T> ViewModel.loadInto(target: MutableStateFlow<Load<T>>, block: suspend () -> T) {
    viewModelScope.launch {
        try {
            target.value = Load.Data(block())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            target.value = Load.Error(e.message ?: "Something went wrong. Please try again.")
        }
    }
}
