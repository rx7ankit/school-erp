package `in`.scool.app.features.leave

import androidx.compose.runtime.Composable
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.R
import `in`.scool.app.app.VmFactory
import `in`.scool.app.app.loadInto
import `in`.scool.app.app.toUiText
import `in`.scool.app.data.Repository
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.LEAVE_REASON_MAX
import `in`.scool.app.domain.LeaveHalf
import `in`.scool.app.domain.LeaveRequest
import `in`.scool.app.domain.LeaveStatus
import `in`.scool.app.domain.Load
import `in`.scool.app.domain.UiText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

data class LeaveUi(val cancellingId: String? = null, val error: UiText? = null)

/** A child's leave requests. Reloads on resume so a request applied on the next screen shows up. */
class LeaveViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<List<LeaveRequest>>>(Load.Loading)
    val state: StateFlow<Load<List<LeaveRequest>>> = _state.asStateFlow()

    private val _ui = MutableStateFlow(LeaveUi())
    val ui: StateFlow<LeaveUi> = _ui.asStateFlow()

    fun refresh() {
        loadInto(_state) { repository.leaveRequests(childId) }
    }

    fun cancel(id: String) {
        if (_ui.value.cancellingId != null) return
        _ui.value = LeaveUi(cancellingId = id)
        viewModelScope.launch {
            try {
                repository.cancelLeave(id)
                refresh()
                _ui.value = LeaveUi()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _ui.value = LeaveUi(error = e.toUiText(R.string.error_leave_cancel))
                refresh()
            }
        }
    }
}

fun Load<List<LeaveRequest>>.pendingCount(): Int =
    (this as? Load.Data)?.value?.count { it.status == LeaveStatus.PENDING } ?: 0

@Composable
fun leaveViewModel(repository: Repository, childId: String): LeaveViewModel {
    val vm: LeaveViewModel = viewModel(
        key = "leave-$childId",
        factory = VmFactory { LeaveViewModel(repository, childId) },
    )
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.refresh() }
    return vm
}

data class LeaveForm(
    val from: LocalDate,
    val to: LocalDate,
    val half: LeaveHalf = LeaveHalf.NONE,
    val reason: String = "",
    val submitting: Boolean = false,
    val error: UiText? = null,
) {
    val canSubmit: Boolean get() = reason.isNotBlank() && !submitting
    /** Half day is only offered for a single day. */
    val halfAllowed: Boolean get() = from == to
}

class LeaveApplyViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _form = MutableStateFlow(Ist.today().let { LeaveForm(from = it, to = it) })
    val form: StateFlow<LeaveForm> = _form.asStateFlow()

    fun setFrom(date: LocalDate) = _form.update {
        val to = if (it.to.isBefore(date)) date else it.to
        it.copy(from = date, to = to, half = if (date == to) it.half else LeaveHalf.NONE, error = null)
    }

    fun setTo(date: LocalDate) = _form.update {
        it.copy(to = date, half = if (it.from == date) it.half else LeaveHalf.NONE, error = null)
    }

    fun setHalf(half: LeaveHalf) = _form.update { if (it.halfAllowed) it.copy(half = half) else it }

    fun setReason(text: String) = _form.update { it.copy(reason = text.take(LEAVE_REASON_MAX), error = null) }

    fun submit(onDone: () -> Unit) {
        val f = _form.value
        if (!f.canSubmit) return
        _form.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            try {
                repository.applyLeave(childId, f.from, f.to, f.half, f.reason)
                onDone()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _form.update { it.copy(error = e.toUiText(R.string.error_leave_apply)) }
            } finally {
                _form.update { it.copy(submitting = false) }
            }
        }
    }
}
