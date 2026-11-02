package tech.krevo.app.features.feedback

import tech.krevo.app.R
import tech.krevo.app.app.toUiText
import tech.krevo.app.domain.AppError
import tech.krevo.app.domain.AppException
import tech.krevo.app.domain.UiText
import androidx.compose.runtime.Composable
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import tech.krevo.app.app.VmFactory
import tech.krevo.app.app.loadInto
import tech.krevo.app.data.Repository
import tech.krevo.app.domain.FEEDBACK_COMMENT_MAX
import tech.krevo.app.domain.FeedbackRating
import tech.krevo.app.domain.FeedbackRequest
import tech.krevo.app.domain.Load
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Open feedback requests for one child. Reloads whenever the screen is resumed. */
class FeedbackViewModel(private val repository: Repository, private val childId: String) : ViewModel() {
    private val _state = MutableStateFlow<Load<List<FeedbackRequest>>>(Load.Loading)
    val state: StateFlow<Load<List<FeedbackRequest>>> = _state.asStateFlow()

    fun refresh() {
        loadInto(_state) { repository.feedbackRequests(childId) }
    }
}

/** True while at least one request of the loaded list is still unanswered. */
fun Load<List<FeedbackRequest>>.hasPending(): Boolean = (this as? Load.Data)?.value?.any { it.pending } == true

/** The view model for [childId], refreshed on every resume so a submit elsewhere clears the dot and card. */
@Composable
fun feedbackViewModel(repository: Repository, childId: String): FeedbackViewModel {
    val vm: FeedbackViewModel = viewModel(
        key = "feedback-$childId",
        factory = VmFactory { FeedbackViewModel(repository, childId) },
    )
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.refresh() }
    return vm
}

data class FeedbackForm(
    val stars: Map<String, Int> = emptyMap(),
    val comments: Map<String, String> = emptyMap(),
    val submitting: Boolean = false,
    val error: UiText? = null,
) {
    val canSubmit: Boolean get() = !submitting && stars.values.any { it > 0 }
}

/** One request being answered. */
class FeedbackRatingViewModel(
    private val repository: Repository,
    private val childId: String,
    private val requestId: String,
) : ViewModel() {
    private val _state = MutableStateFlow<Load<FeedbackRequest>>(Load.Loading)
    val state: StateFlow<Load<FeedbackRequest>> = _state.asStateFlow()

    private val _form = MutableStateFlow(FeedbackForm())
    val form: StateFlow<FeedbackForm> = _form.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.value = Load.Loading
        loadInto(_state) { fetch() }
    }

    private suspend fun fetch(): FeedbackRequest =
        repository.feedbackRequests(childId).firstOrNull { it.id == requestId }
            ?: throw AppException(AppError.FEEDBACK_CLOSED)

    fun setStars(targetId: String, stars: Int) = _form.update { it.copy(stars = it.stars + (targetId to stars), error = null) }

    fun setComment(targetId: String, text: String) =
        _form.update { it.copy(comments = it.comments + (targetId to text.take(FEEDBACK_COMMENT_MAX))) }

    fun submit() {
        val f = _form.value
        if (!f.canSubmit) return
        val ratings = f.stars.filterValues { it > 0 }.map { (id, stars) ->
            FeedbackRating(id, stars, f.comments[id]?.trim()?.ifEmpty { null })
        }
        _form.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
            try {
                repository.submitFeedback(requestId, childId, ratings)
                _state.value = Load.Data(fetch())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _form.update { it.copy(error = e.toUiText(R.string.error_feedback_send)) }
            } finally {
                _form.update { it.copy(submitting = false) }
            }
        }
    }
}
