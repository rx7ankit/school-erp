package tech.krevo.app.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import tech.krevo.app.R
import tech.krevo.app.domain.AppError
import tech.krevo.app.domain.AppException
import tech.krevo.app.domain.Load
import tech.krevo.app.domain.UiText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

/** Tiny factory so view models can take constructor arguments without a DI library. */
class VmFactory<T : ViewModel>(private val make: () -> T) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <V : ViewModel> create(modelClass: Class<V>): V = make() as V
}

/** What the parent reads for a failure. Known app errors have their own text, anything else gets [fallbackId]. */
fun Throwable.toUiText(fallbackId: Int = R.string.error_generic): UiText = when (this) {
    is AppException -> UiText.Res(
        when (error) {
            AppError.WRONG_LOGIN -> R.string.err_wrong_login
            AppError.SIGN_IN_AGAIN -> R.string.err_sign_in_again
            AppError.RESULT_NOT_FOUND -> R.string.err_result_not_found
            AppError.EMPTY_MESSAGE -> R.string.err_empty_message
            AppError.FEEDBACK_CLOSED -> R.string.err_feedback_closed
            AppError.FEEDBACK_ALREADY_SENT -> R.string.err_feedback_sent
            AppError.FEEDBACK_NEEDS_STAR -> R.string.err_feedback_star
            AppError.LEAVE_DATES -> R.string.err_leave_dates
            AppError.LEAVE_IN_PAST -> R.string.err_leave_past
            AppError.LEAVE_REASON_REQUIRED -> R.string.err_leave_reason
            AppError.LEAVE_REASON_TOO_LONG -> R.string.err_leave_reason_long
            AppError.LEAVE_HALF_SINGLE_DAY -> R.string.err_leave_half
            AppError.LEAVE_NOT_PENDING -> R.string.err_leave_not_pending
            AppError.LEAVE_CHILD_LEFT -> R.string.err_leave_left
            AppError.THREAD_INACTIVE -> R.string.err_thread_inactive
            AppError.MESSAGING_OFF -> R.string.err_messaging_off
        },
    )
    else -> UiText.Res(fallbackId)
}

/** Runs [block] and publishes Data or Error into [target]. Keeps the old data visible while refreshing. */
fun <T> ViewModel.loadInto(target: MutableStateFlow<Load<T>>, block: suspend () -> T) {
    viewModelScope.launch {
        try {
            target.value = Load.Data(block())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            target.value = Load.Error(e.toUiText())
        }
    }
}
