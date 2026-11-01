package `in`.scool.app.features.messages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import `in`.scool.app.R
import `in`.scool.app.app.loadInto
import `in`.scool.app.app.toUiText
import `in`.scool.app.data.Repository
import `in`.scool.app.domain.Broadcast
import `in`.scool.app.domain.ChatMessage
import `in`.scool.app.domain.Load
import `in`.scool.app.domain.MessageThread
import `in`.scool.app.domain.UiText
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class MessagesData(val broadcasts: List<Broadcast>, val threads: List<MessageThread>)

class MessagesViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<MessagesData>>(Load.Loading)
    val state: StateFlow<Load<MessagesData>> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = Load.Loading
        loadInto(_state) {
            coroutineScope {
                val b = async { repository.broadcasts(childId) }
                val t = async { repository.threads(childId) }
                MessagesData(b.await().sortedByDescending { it.at }, t.await())
            }
        }
    }
}

data class ChatData(val thread: MessageThread?, val messages: List<ChatMessage>)

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
                val thread = async { repository.threads(childId).firstOrNull { it.id == threadId } }
                val messages = async { repository.messages(threadId) }
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
                val sent = repository.send(threadId, text)
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
