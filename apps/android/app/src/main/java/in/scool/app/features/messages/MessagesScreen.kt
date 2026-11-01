package `in`.scool.app.features.messages

import androidx.compose.ui.res.stringResource
import `in`.scool.app.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.app.VmFactory
import `in`.scool.app.data.Repository
import `in`.scool.app.design.Avatar
import `in`.scool.app.design.Chip
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.SegmentedControl
import `in`.scool.app.design.loadContent
import `in`.scool.app.domain.Broadcast
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.MessageThread
import `in`.scool.app.domain.initialsOf
import `in`.scool.app.features.profile.LeftSchoolBanner

@Composable
fun MessagesScreen(child: Child, repository: Repository, onOpenThread: (String) -> Unit) {
    val vm: MessagesViewModel = viewModel(
        key = "messages-${child.id}",
        factory = VmFactory { MessagesViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(0) }

    ScoolList {
        item { ScreenHeader(
                ink = stringResource(R.string.msg_title_ink),
                grey = stringResource(R.string.msg_title_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className),
            ) }
        item { SegmentedControl(
                options = listOf(stringResource(R.string.msg_tab_class), stringResource(R.string.msg_tab_personal)),
                selectedIndex = tab,
                onSelect = { tab = it },
            ) }
        if (tab == 1 && !child.isActive) item { LeftSchoolBanner(child) }
        loadContent(state, onRetry = vm::load) { data ->
            if (tab == 0) {
                if (data.broadcasts.isEmpty()) item { EmptyText(stringResource(R.string.msg_empty_class)) }
                data.broadcasts.forEach { b -> item(key = b.id) { BroadcastCard(b) } }
            } else {
                if (data.threads.isEmpty()) item { EmptyText(stringResource(R.string.msg_empty_personal)) }
                data.threads.forEach { t -> item(key = t.id) { ThreadCard(t, onClick = { onOpenThread(t.id) }) } }
            }
        }
    }
}

@Composable
private fun EmptyText(text: String) {
    Text(text, style = MaterialTheme.typography.bodyLarge, color = Scool.colors.textSecondary)
}

@Composable
private fun BroadcastCard(b: Broadcast) {
    ScoolCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Chip(b.subject)
            Text(Ist.dateTime(b.at), style = MaterialTheme.typography.bodySmall, color = Scool.colors.textSecondary)
        }
        Text(b.teacher, style = MaterialTheme.typography.titleSmall, color = Scool.colors.text, modifier = Modifier.padding(top = 10.dp))
        Text(b.text, style = MaterialTheme.typography.bodyLarge, color = Scool.colors.text, modifier = Modifier.padding(top = 2.dp))
        if (b.attachment != null) {
            Chip(
                text = stringResource(R.string.msg_attachment, b.attachment),
                modifier = Modifier.padding(top = 10.dp),
                background = Scool.colors.bg,
            )
        }
    }
}

@Composable
private fun ThreadCard(t: MessageThread, onClick: () -> Unit) {
    ScoolCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(initials = initialsOf(t.teacher), size = 44.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(t.teacher, style = MaterialTheme.typography.titleMedium, color = Scool.colors.text)
                Text(
                    if (t.isClassTeacher) stringResource(R.string.class_teacher) else t.subject,
                    style = MaterialTheme.typography.bodySmall, color = Scool.colors.textSecondary)
                Text(
                    t.lastMessage,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Scool.colors.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Text(
                Ist.dateOfInstant(t.lastAt),
                style = MaterialTheme.typography.bodySmall,
                color = Scool.colors.textTertiary,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
    }
}
