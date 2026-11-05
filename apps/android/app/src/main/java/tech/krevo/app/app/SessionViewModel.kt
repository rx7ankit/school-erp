package tech.krevo.app.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import tech.krevo.app.data.LanguageStore
import tech.krevo.app.data.PrefsStore
import tech.krevo.app.data.Repository
import tech.krevo.app.domain.AppLanguage
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.NotificationCategory
import tech.krevo.app.domain.User
import tech.krevo.app.domain.UserKind
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Who is signed in, which child is selected (persisted), and the appearance and language settings. */
class SessionViewModel(
    private val repository: Repository,
    private val prefs: PrefsStore,
    private val languageStore: LanguageStore,
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

    val notificationSettings: StateFlow<Map<NotificationCategory, Boolean>> =
        prefs.notificationSettings.stateIn(
            viewModelScope, SharingStarted.Eagerly, NotificationCategory.entries.associateWith { true },
        )

    val dismissedPromotions: StateFlow<Set<String>> =
        prefs.dismissedPromotions.stateIn(viewModelScope, SharingStarted.Eagerly, emptySet())

    private val _language = MutableStateFlow(languageStore.current())

    /** The language the app shows. Updated at once when the parent switches, before the activity is recreated. */
    val language: StateFlow<AppLanguage> = _language.asStateFlow()

    /** null while the saved value loads, then whether the parent has picked a language yet (false = show the first launch chooser). */
    val languageChosen: StateFlow<Boolean?> =
        languageStore.chosen.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    /** Called by the login screen after a successful sign in. Loads the children first so Home never opens empty. */
    suspend fun completeSignIn(user: User) {
        _children.value = if (user.kind == UserKind.PARENT) repository.children() else emptyList()
        _user.value = user
        // The language may have been picked while signed out: tell the backend once we can.
        if (languageChosen.value == true) syncLanguage(_language.value)
    }

    fun passwordChanged() {
        _user.update { it?.copy(mustChangePassword = false) }
    }

    fun signOut() {
        viewModelScope.launch { try { repository.signOut() } catch (_: Exception) { } }
        _user.value = null
        _children.value = emptyList()
    }

    fun selectChild(id: String) {
        viewModelScope.launch { prefs.setSelectedChild(id) }
    }

    /** Switches the app language without restarting, remembers the choice and (when signed in as a parent) tells the backend. */
    fun setLanguage(language: AppLanguage) {
        if (language == _language.value && languageChosen.value == true) return
        _language.value = language
        syncLanguage(language)
        viewModelScope.launch { languageStore.choose(language) }
    }

    /** Fire-and-forget `PATCH /parent/preferences {language}`: a failure never blocks or shows an error. */
    private fun syncLanguage(language: AppLanguage) {
        if (_user.value?.kind != UserKind.PARENT) return
        viewModelScope.launch {
            try {
                repository.setLanguage(language.code)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Best effort. The app already shows the new language.
            } catch (e: NotImplementedError) {
                // ApiRepository is still a stub.
            }
        }
    }

    fun dismissPromotion(notificationId: String) {
        viewModelScope.launch { prefs.dismissPromotion(notificationId) }
    }

    fun setNotificationEnabled(category: NotificationCategory, enabled: Boolean) {
        viewModelScope.launch { prefs.setNotificationEnabled(category, enabled) }
    }
}
