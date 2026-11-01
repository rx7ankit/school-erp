package `in`.scool.app.features.feedback

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.app.VmFactory
import `in`.scool.app.data.Repository
import `in`.scool.app.design.ButtonKind
import `in`.scool.app.design.Chip
import `in`.scool.app.design.PillButton
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScoolTextField
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.loadContent
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.FEEDBACK_COMMENT_MAX
import `in`.scool.app.domain.FeedbackRequest
import `in`.scool.app.domain.FeedbackTarget
import `in`.scool.app.domain.Ist

private const val ANONYMOUS_NOTE = "Thank you. Your feedback is anonymous to teachers."

@Composable
fun FeedbackScreen(child: Child, repository: Repository, onOpen: (String) -> Unit, onBack: () -> Unit) {
    val vm = feedbackViewModel(repository, child.id)
    val state by vm.state.collectAsStateWithLifecycle()

    ScoolList {
        item {
            ScreenHeader(
                ink = "Feedback.", grey = "Rate your teachers.",
                context = "${child.firstName} · Class ${child.className}", onBack = onBack,
            )
        }
        loadContent(state, onRetry = vm::refresh) { requests ->
            if (requests.isEmpty()) {
                item { Text("No open feedback requests.", style = MaterialTheme.typography.bodyLarge, color = Scool.colors.textSecondary) }
            }
            requests.forEach { r ->
                item(key = r.id) {
                    ScoolCard(onClick = { onOpen(r.id) }) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(r.title, style = MaterialTheme.typography.titleMedium, color = Scool.colors.text, modifier = Modifier.weight(1f))
                            Chip(if (r.answered) "Answered" else "To answer", modifier = Modifier.padding(start = 8.dp))
                        }
                        Text(
                            "Closes ${Ist.date(r.closesOn)}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Scool.colors.textSecondary,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun FeedbackRatingScreen(child: Child, requestId: String, repository: Repository, onBack: () -> Unit) {
    val vm: FeedbackRatingViewModel = viewModel(
        key = "feedback-$requestId-${child.id}",
        factory = VmFactory { FeedbackRatingViewModel(repository, child.id, requestId) },
    )
    val state by vm.state.collectAsStateWithLifecycle()
    val form by vm.form.collectAsStateWithLifecycle()

    ScoolList {
        item {
            ScreenHeader(
                ink = "Feedback.", grey = "Rate each teacher.",
                context = "${child.firstName} · Class ${child.className}", onBack = onBack,
            )
        }
        loadContent(state, onRetry = vm::load) { request ->
            val readOnly = request.answered
            item {
                Text(
                    "${request.title} · closes ${Ist.date(request.closesOn)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Scool.colors.textSecondary,
                )
            }
            request.targets.forEach { target ->
                item(key = target.id) {
                    TeacherCard(request, target, form, readOnly, vm::setStars, vm::setComment)
                }
            }
            if (readOnly) {
                item { Text(ANONYMOUS_NOTE, style = MaterialTheme.typography.bodyMedium, color = Scool.colors.textSecondary) }
            } else {
                form.error?.let { msg ->
                    item { Text(msg, style = MaterialTheme.typography.bodyMedium, color = Scool.colors.danger) }
                }
                item {
                    PillButton(
                        text = "Submit",
                        onClick = vm::submit,
                        kind = ButtonKind.BRAND,
                        enabled = form.canSubmit,
                        loading = form.submitting,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

@Composable
private fun TeacherCard(
    request: FeedbackRequest,
    target: FeedbackTarget,
    form: FeedbackForm,
    readOnly: Boolean,
    onStars: (String, Int) -> Unit,
    onComment: (String, String) -> Unit,
) {
    val sent = request.submitted.firstOrNull { it.targetId == target.id }
    ScoolCard {
        Text(target.teacher, style = MaterialTheme.typography.titleMedium, color = Scool.colors.text)
        Text(
            if (target.isClassTeacher) "${target.subject} · Class teacher" else target.subject,
            style = MaterialTheme.typography.bodyMedium,
            color = Scool.colors.textSecondary,
        )
        if (readOnly) {
            StarRating(value = sent?.rating ?: 0, onValueChange = null, modifier = Modifier.padding(top = 8.dp))
            sent?.comment?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = Scool.colors.text, modifier = Modifier.padding(top = 4.dp))
            }
        } else {
            StarRating(
                value = form.stars[target.id] ?: 0,
                onValueChange = { onStars(target.id, it) },
                enabled = !form.submitting,
                modifier = Modifier.padding(top = 8.dp),
            )
            val comment = form.comments[target.id].orEmpty()
            ScoolTextField(
                value = comment,
                onValueChange = { onComment(target.id, it) },
                label = "Comment (optional)",
                singleLine = false,
                enabled = !form.submitting,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                "${comment.length}/$FEEDBACK_COMMENT_MAX",
                style = MaterialTheme.typography.bodySmall,
                color = Scool.colors.textSecondary,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            )
        }
    }
}
