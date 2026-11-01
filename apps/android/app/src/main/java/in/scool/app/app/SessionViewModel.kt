package `in`.scool.app.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import `in`.scool.app.data.PrefsStore
import `in`.scool.app.data.Repository
import `in`.scool.app.design.ThemeMode
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.User
import `in`.scool.app.domain.UserKind
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Who is signed in, which child is selected (persisted), and the appearance setting. */
class SessionViewModel(
    private val repository: Repository,
    private val prefs: PrefsStore,
) : ViewModel() {

    private val _user = MutableStateFlow<User?>(null)
    val user: StateFlow<User?> = _user.asStateFlow()

    private val _children = MutableStateFlow<List<Child>>(emptyList())
    val children: StateFlow<List<Child>> = _children.asStateFlow()

    /** The child the whole app is showing. Falls back to the first child if the saved one is gone. */
    val selectedChild: StateFlow<Child?> =
        combine(_children, prefs.selectedChildId) { list, savedId ->
            list.firstOrNull { it.id == savedId } ?: list.firstOrNull()
        }.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val themeMode: StateFlow<ThemeMode> =
        prefs.themeMode.stateIn(viewModelScope, SharingStarted.Eagerly, ThemeMode.SYSTEM)

    /** Called by the login screen after a successful sign in. Loads the children first so Home never opens empty. */
    suspend fun completeSignIn(user: User) {
        _children.value = if (user.kind == UserKind.PARENT) repository.children() else emptyList()
        _user.value = user
    }

    fun passwordChanged() {
        _user.update { it?.copy(mustChangePassword = false) }
    }

    fun signOut() {
        _user.value = null
        _children.value = emptyList()
    }

    fun selectChild(id: String) {
        viewModelScope.launch { prefs.setSelectedChild(id) }
    }

    fun setThemeMode(mode: ThemeMode) {
        viewModelScope.launch { prefs.setThemeMode(mode) }
    }
}
