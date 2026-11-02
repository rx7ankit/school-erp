package tech.krevo.app.features.notifications

import androidx.compose.runtime.Composable
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import tech.krevo.app.app.VmFactory
import tech.krevo.app.app.loadInto
import tech.krevo.app.data.Repository
import tech.krevo.app.domain.AppNotification
import tech.krevo.app.domain.Load
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** All notifications for the signed-in parent. Reloads on every resume so the Home bell dot stays right. */
class NotificationsViewModel(private val repository: Repository) : ViewModel() {
    private val _state = MutableStateFlow<Load<List<AppNotification>>>(Load.Loading)
    val state: StateFlow<Load<List<AppNotification>>> = _state.asStateFlow()

    fun refresh() {
        loadInto(_state) { repository.notifications() }
    }

    fun markAllRead() {
        val current = (_state.value as? Load.Data)?.value ?: return
        // Show everything as read straight away, then tell the server. A failed call is corrected by the next refresh.
        _state.value = Load.Data(current.map { it.copy(read = true) })
        viewModelScope.launch {
            try {
                repository.markAllRead()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                refresh()
            }
        }
    }
}

/** True when [childId] has at least one unread notification. */
fun Load<List<AppNotification>>.hasUnread(childId: String): Boolean =
    (this as? Load.Data)?.value?.any { !it.read && it.childId == childId } == true

@Composable
fun notificationsViewModel(repository: Repository): NotificationsViewModel {
    val vm: NotificationsViewModel = viewModel(
        key = "notifications",
        factory = VmFactory { NotificationsViewModel(repository) },
    )
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.refresh() }
    return vm
}
