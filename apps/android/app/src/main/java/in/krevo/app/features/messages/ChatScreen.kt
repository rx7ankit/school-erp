package `in`.krevo.app.features.messages

import androidx.compose.ui.res.stringResource
import `in`.krevo.app.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.krevo.app.app.VmFactory
import `in`.krevo.app.data.Repository
import `in`.krevo.app.design.ErrorBox
import `in`.krevo.app.design.LoadingBox
import `in`.krevo.app.design.Radius
import `in`.krevo.app.design.Krevo
import `in`.krevo.app.design.KrevoTextField
import `in`.krevo.app.design.ScreenHeader
import `in`.krevo.app.domain.ThreadMessage
import `in`.krevo.app.domain.Child
import `in`.krevo.app.domain.Ist
import `in`.krevo.app.domain.Load
import `in`.krevo.app.domain.UiText
import `in`.krevo.app.design.asString

@Composable
fun ChatScreen(child: Child, threadId: String, repository: Repository, onBack: () -> Unit) {
    val vm: ChatViewModel = viewModel(
        key = "chat-$threadId",
        factory = VmFactory { ChatViewModel(repository, child.id, threadId) },
    )
    val state by vm.state.collectAsStateWithLifecycle()
    val ui by vm.ui.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize().imePadding()) {
        val data = (state as? Load.Data)?.value
        Box(modifier = Modifier.padding(horizontal = 20.dp)) {
            ScreenHeader(
                ink = data?.thread?.teacher ?: stringResource(R.string.msg_chat),
                grey = data?.thread?.let {
                    when {
                        !it.isActive -> stringResource(R.string.msg_no_longer, it.subject)
                        it.isClassTeacher -> stringResource(R.string.class_teacher)
                        else -> it.subject
                    }
                }.orEmpty(),
                onBack = onBack,
            )
        }
        Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
            when (val s = state) {
                is Load.Loading -> LoadingBox()
                is Load.Error -> Box(Modifier.padding(20.dp)) { ErrorBox(s.message, onRetry = vm::load) }
                is Load.Data -> MessageList(s.value.messages)
            }
        }
        val thread = data?.thread
        if (child.isActive && (thread == null || thread.isActive)) {
            Composer(
                draft = ui.draft,
                sending = ui.sending,
                error = ui.error,
                enabled = state is Load.Data,
                onDraft = vm::setDraft,
                onSend = vm::send,
            )
        } else {
            Text(
                // Left school wins: everything is read-only. Otherwise the thread is a previous teacher's.
                text = if (!child.isActive || thread == null) {
                    stringResource(R.string.msg_off_left, child.firstName)
                } else {
                    stringResource(R.string.msg_inactive_banner, thread.teacher, thread.subject, child.firstName)
                },
                style = MaterialTheme.typography.bodyMedium,
                color = Krevo.colors.textSecondary,
                modifier = Modifier.padding(20.dp),
            )
        }
    }
}

@Composable
private fun MessageList(messages: List<ThreadMessage>) {
    val listState = rememberLazyListState()
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(messages.size, key = { messages[it].id }) { index -> Bubble(messages[index]) }
    }
}

@Composable
private fun Bubble(m: ThreadMessage) {
    val c = Krevo.colors
    val bg = if (m.mine) c.solid else c.card
    val fg = if (m.mine) c.onSolid else c.text
    val who = if (m.mine) stringResource(R.string.you) else m.from
    val description = "$who, ${Ist.dateTime(m.at)}: ${m.body}"
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { contentDescription = description },
        contentAlignment = if (m.mine) Alignment.CenterEnd else Alignment.CenterStart,
    ) {
        Surface(
            modifier = Modifier.widthIn(max = 300.dp),
            shape = RoundedCornerShape(Radius.card),
            color = bg,
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
        ) {
            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                Text(m.body, style = MaterialTheme.typography.bodyLarge, color = fg)
                Text(
                    Ist.dateTime(m.at),
                    style = MaterialTheme.typography.bodySmall,
                    color = fg.copy(alpha = 0.7f),
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

@Composable
private fun Composer(
    draft: String,
    sending: Boolean,
    error: UiText?,
    enabled: Boolean,
    onDraft: (String) -> Unit,
    onSend: () -> Unit,
) {
    val c = Krevo.colors
    Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
        if (error != null) {
            Text(error.asString(), style = MaterialTheme.typography.bodyMedium, color = c.danger, modifier = Modifier.padding(bottom = 6.dp))
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KrevoTextField(
                value = draft,
                onValueChange = onDraft,
                label = stringResource(R.string.msg_composer),
                singleLine = false,
                enabled = enabled && !sending,
                modifier = Modifier.weight(1f),
            )
            val canSend = enabled && !sending && draft.isNotBlank()
            IconButton(
                onClick = onSend,
                enabled = canSend,
                modifier = Modifier.size(56.dp),
                colors = IconButtonDefaults.iconButtonColors(
                    containerColor = c.accent,
                    contentColor = c.onAccent,
                    disabledContainerColor = c.fill,
                    disabledContentColor = c.textTertiary,
                ),
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = stringResource(R.string.msg_send))
            }
        }
    }
}
