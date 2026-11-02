package tech.slov.app.features.feedback

import androidx.compose.ui.res.stringResource
import tech.slov.app.R
import tech.slov.app.design.asString
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
import tech.slov.app.app.VmFactory
import tech.slov.app.data.Repository
import tech.slov.app.design.ButtonKind
import tech.slov.app.design.Chip
import tech.slov.app.design.PillButton
import tech.slov.app.design.Slov
import tech.slov.app.design.SlovCard
import tech.slov.app.design.SlovList
import tech.slov.app.design.SlovTextField
import tech.slov.app.design.ScreenHeader
import tech.slov.app.design.loadContent
import tech.slov.app.domain.Child
import tech.slov.app.domain.FEEDBACK_COMMENT_MAX
import tech.slov.app.domain.FeedbackRequest
import tech.slov.app.domain.FeedbackTarget
import tech.slov.app.domain.Ist

@Composable
fun FeedbackScreen(child: Child, repository: Repository, onOpen: (String) -> Unit, onBack: () -> Unit) {
    val vm = feedbackViewModel(repository, child.id)
    val state by vm.state.collectAsStateWithLifecycle()

    SlovList {
        item {
            ScreenHeader(
                ink = stringResource(R.string.feedback_title_ink), grey = stringResource(R.string.feedback_title_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className), onBack = onBack,
            )
        }
        loadContent(state, onRetry = vm::refresh) { requests ->
            if (requests.isEmpty()) {
                item { Text(stringResource(R.string.feedback_empty), style = MaterialTheme.typography.bodyLarge, color = Slov.colors.textSecondary) }
            }
            requests.forEach { r ->
                item(key = r.id) {
                    SlovCard(onClick = { onOpen(r.id) }) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(r.title, style = MaterialTheme.typography.titleMedium, color = Slov.colors.text, modifier = Modifier.weight(1f))
                            Chip(stringResource(if (r.answered) R.string.feedback_answered else R.string.feedback_to_answer), modifier = Modifier.padding(start = 8.dp))
                        }
                        Text(
                            stringResource(R.string.feedback_closes, Ist.date(r.closesOn)),
                            style = MaterialTheme.typography.bodyMedium,
                            color = Slov.colors.textSecondary,
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

    SlovList {
        item {
            ScreenHeader(
                ink = stringResource(R.string.feedback_title_ink), grey = stringResource(R.string.feedback_rate_each),
                context = stringResource(R.string.child_context, child.firstName, child.className), onBack = onBack,
            )
        }
        loadContent(state, onRetry = vm::load) { request ->
            val readOnly = request.answered
            item {
                Text(
                    stringResource(R.string.feedback_request_line, request.title, Ist.date(request.closesOn)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Slov.colors.textSecondary,
                )
            }
            request.targets.forEach { target ->
                item(key = target.id) {
                    TeacherCard(request, target, form, readOnly, vm::setStars, vm::setComment)
                }
            }
            if (readOnly) {
                item { Text(stringResource(R.string.feedback_thanks), style = MaterialTheme.typography.bodyMedium, color = Slov.colors.textSecondary) }
            } else {
                form.error?.let { msg ->
                    item { Text(msg.asString(), style = MaterialTheme.typography.bodyMedium, color = Slov.colors.danger) }
                }
                item {
                    PillButton(
                        text = stringResource(R.string.feedback_submit),
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
    SlovCard {
        Text(target.teacher, style = MaterialTheme.typography.titleMedium, color = Slov.colors.text)
        Text(
            if (target.isClassTeacher) stringResource(R.string.feedback_subject_class_teacher, target.subject) else target.subject,
            style = MaterialTheme.typography.bodyMedium,
            color = Slov.colors.textSecondary,
        )
        if (readOnly) {
            StarRating(value = sent?.rating ?: 0, onValueChange = null, modifier = Modifier.padding(top = 8.dp))
            sent?.comment?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium, color = Slov.colors.text, modifier = Modifier.padding(top = 4.dp))
            }
        } else {
            StarRating(
                value = form.stars[target.id] ?: 0,
                onValueChange = { onStars(target.id, it) },
                enabled = !form.submitting,
                modifier = Modifier.padding(top = 8.dp),
            )
            val comment = form.comments[target.id].orEmpty()
            SlovTextField(
                value = comment,
                onValueChange = { onComment(target.id, it) },
                label = stringResource(R.string.feedback_comment),
                singleLine = false,
                enabled = !form.submitting,
                modifier = Modifier.padding(top = 8.dp),
            )
            Text(
                "${comment.length}/$FEEDBACK_COMMENT_MAX",
                style = MaterialTheme.typography.bodySmall,
                color = Slov.colors.textSecondary,
                textAlign = TextAlign.End,
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            )
        }
    }
}
