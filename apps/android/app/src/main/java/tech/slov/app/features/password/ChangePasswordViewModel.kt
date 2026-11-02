package tech.slov.app.features.password

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import tech.slov.app.R
import tech.slov.app.app.toUiText
import tech.slov.app.data.Repository
import tech.slov.app.domain.PasswordProblem
import tech.slov.app.domain.PasswordRules
import tech.slov.app.domain.UiText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ChangePasswordUi(
    val newPassword: String = "",
    val confirm: String = "",
    val busy: Boolean = false,
    val error: UiText? = null,
)

class ChangePasswordViewModel(private val repository: Repository) : ViewModel() {
    private val _ui = MutableStateFlow(ChangePasswordUi())
    val ui: StateFlow<ChangePasswordUi> = _ui.asStateFlow()

    fun setNew(value: String) = _ui.update { it.copy(newPassword = value, error = null) }
    fun setConfirm(value: String) = _ui.update { it.copy(confirm = value, error = null) }

    fun submit(onSuccess: () -> Unit) {
        val s = _ui.value
        if (s.busy) return
        val problem: UiText? = when (PasswordRules.check(s.newPassword)) {
            PasswordProblem.TOO_SHORT -> UiText.Res(R.string.password_err_short)
            PasswordProblem.NO_LETTER -> UiText.Res(R.string.password_err_letter)
            PasswordProblem.NO_NUMBER -> UiText.Res(R.string.password_err_number)
            null -> if (s.newPassword != s.confirm) UiText.Res(R.string.password_err_mismatch) else null
        }
        if (problem != null) {
            _ui.update { it.copy(error = problem) }
            return
        }
        _ui.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                repository.changePassword(s.newPassword)
                _ui.update { ChangePasswordUi() }
                onSuccess()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _ui.update { it.copy(busy = false, error = e.toUiText(R.string.error_change_password)) }
            }
        }
    }
}
