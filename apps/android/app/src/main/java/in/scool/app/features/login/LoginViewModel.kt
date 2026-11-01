package `in`.scool.app.features.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import `in`.scool.app.R
import `in`.scool.app.app.SessionViewModel
import `in`.scool.app.app.toUiText
import `in`.scool.app.data.Repository
import `in`.scool.app.domain.UiText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUi(
    val email: String = "",
    val password: String = "",
    val busy: Boolean = false,
    val error: UiText? = null,
)

class LoginViewModel(
    private val repository: Repository,
    private val session: SessionViewModel,
) : ViewModel() {
    private val _ui = MutableStateFlow(LoginUi())
    val ui: StateFlow<LoginUi> = _ui.asStateFlow()

    fun setEmail(value: String) = _ui.update { it.copy(email = value, error = null) }
    fun setPassword(value: String) = _ui.update { it.copy(password = value, error = null) }

    fun submit() {
        val s = _ui.value
        if (s.busy) return
        if (s.email.isBlank() || s.password.isEmpty()) {
            _ui.update { it.copy(error = UiText.Res(R.string.login_enter_both)) }
            return
        }
        _ui.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            try {
                val user = repository.login(s.email, s.password)
                session.completeSignIn(user)
                _ui.update { it.copy(busy = false, password = "") }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _ui.update { it.copy(busy = false, error = e.toUiText(R.string.error_sign_in)) }
            }
        }
    }
}
