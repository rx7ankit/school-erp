package tech.krevo.app.features.messages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import tech.krevo.app.R
import tech.krevo.app.app.loadInto
import tech.krevo.app.app.toUiText
import tech.krevo.app.data.Repository
import tech.krevo.app.domain.Load
import tech.krevo.app.domain.TeacherThread
import tech.krevo.app.domain.ThreadMessage
import tech.krevo.app.domain.UiText
import tech.krevo.app.domain.Update
import tech.krevo.app.domain.UpdateKind
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MessagesData(val updates: List<Update>, val threads: List<TeacherThread>) {
    val unreadUpdates: Int get() = updates.count { !it.read }
    val latestUpdate: Update? get() = updates.maxByOrNull { it.at }
    /** Active teachers: class teacher first, then newest message first. */
    val teachers: List<TeacherThread>
        get() = threads.filter { it.isActive }
            .sortedWith(compareByDescending<TeacherThread> { it.isClassTeacher }.thenByDescending { it.lastAt })
    val previousTeachers: List<TeacherThread> get() = threads.filter { !it.isActive }.sortedByDescending { it.lastAt }
}

/** The Messages tab: Updates row (latest item and unread count) plus the teacher threads. Reloaded on resume. */
class MessagesViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<MessagesData>>(Load.Loading)
    val state: StateFlow<Load<MessagesData>> = _state.asStateFlow()

    fun load() {
        _state.value = Load.Loading
        refresh()
    }

    fun refresh() {
        loadInto(_state) {
            coroutineScope {
                val u = async { repository.updates(childId) }
                val t = async { repository.teacherThreads(childId) }
                MessagesData(u.await(), t.await())
            }
        }
    }
}

/** What the filter row selects. */
sealed interface UpdateFilter {
    data object All : UpdateFilter
    data object School : UpdateFilter
    data class Subject(val name: String) : UpdateFilter
}

fun List<Update>.matching(filter: UpdateFilter): List<Update> = when (filter) {
    UpdateFilter.All -> this
    UpdateFilter.School -> filter { it.kind == UpdateKind.SCHOOL }
    is UpdateFilter.Subject -> filter { it.kind == UpdateKind.CLASS && it.subject == filter.name }
}

/** The subjects that appear in the feed, for the filter row. */
fun List<Update>.subjects(): List<String> =
    filter { it.kind == UpdateKind.CLASS }.mapNotNull { it.subject }.distinct().sorted()

/** The full Updates feed. Unread markers stay for this visit; the items are marked read once loaded. */
class UpdatesViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<List<Update>>>(Load.Loading)
    val state: StateFlow<Load<List<Update>>> = _state.asStateFlow()

    private val _filter = MutableStateFlow<UpdateFilter>(UpdateFilter.All)
    val filter: StateFlow<UpdateFilter> = _filter.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = Load.Loading
        loadInto(_state) {
            val items = repository.updates(childId).sortedByDescending { it.at }
            try {
                repository.markUpdatesRead(childId)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Marking read is best effort; the feed still shows.
            }
            items
        }
    }

    fun select(f: UpdateFilter) {
        _filter.value = f
    }
}

data class ChatData(val thread: TeacherThread?, val messages: List<ThreadMessage>)

data class ChatUi(val draft: String = "", val sending: Boolean = false, val error: UiText? = null)

class ChatViewModel(
    private val repository: Repository,
    private val childId: String,
    private val threadId: String,
) : ViewModel() {
    private val _state = MutableStateFlow<Load<ChatData>>(Load.Loading)
    val state: StateFlow<Load<ChatData>> = _state.asStateFlow()

    private val _ui = MutableStateFlow(ChatUi())
    val ui: StateFlow<ChatUi> = _ui.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = Load.Loading
        loadInto(_state) {
            coroutineScope {
                val thread = async { repository.teacherThreads(childId).firstOrNull { it.id == threadId } }
                val messages = async { repository.threadMessages(threadId) }
                ChatData(thread.await(), messages.await())
            }
        }
    }

    fun setDraft(value: String) = _ui.update { it.copy(draft = value, error = null) }

    fun send() {
        val s = _ui.value
        val text = s.draft.trim()
        val current = _state.value
        if (text.isEmpty() || s.sending || current !is Load.Data) return
        _ui.update { it.copy(sending = true, error = null) }
        viewModelScope.launch {
            try {
                val sent = repository.sendMessage(threadId, text)
                val latest = current.value
                _state.value = Load.Data(latest.copy(messages = latest.messages + sent))
                _ui.update { it.copy(draft = "", sending = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _ui.update { it.copy(sending = false, error = e.toUiText(R.string.error_send)) }
            }
        }
    }
}
