package tech.krevo.app.features.messages

import tech.krevo.app.design.MessagesSkeleton
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import tech.krevo.app.R
import tech.krevo.app.app.VmFactory
import tech.krevo.app.data.Repository
import tech.krevo.app.design.Avatar
import tech.krevo.app.design.Chip
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoCard
import tech.krevo.app.design.KrevoList
import tech.krevo.app.design.ScreenHeader
import tech.krevo.app.design.SectionLabel
import tech.krevo.app.design.loadContent
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.Ist
import tech.krevo.app.domain.TeacherThread
import tech.krevo.app.domain.Update
import tech.krevo.app.features.notices.NoticeDetail
import tech.krevo.app.features.notices.NoticeSheet
import tech.krevo.app.features.notices.detail
import tech.krevo.app.domain.initialsOf
import tech.krevo.app.features.profile.LeftSchoolBanner

@Composable
fun MessagesScreen(child: Child, repository: Repository, onOpenUpdates: () -> Unit, onOpenThread: (String) -> Unit) {
    var open by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<NoticeDetail?>(null) }
    val vm: MessagesViewModel = viewModel(
        key = "messages-${child.id}",
        factory = VmFactory { MessagesViewModel(repository, child.id) },
    )
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { vm.refresh() }
    val state by vm.state.collectAsStateWithLifecycle()

    open?.let { NoticeSheet(it, onDismiss = { open = null }) }
    KrevoList {
        if (!child.isActive) item { LeftSchoolBanner(child) }
        loadContent(state, onRetry = vm::load, skeleton = { MessagesSkeleton() }) { data ->
            item { SectionLabel(stringResource(R.string.msg_notices)) }
            val notices = data.updates.sortedByDescending { it.at }.take(20)
            if (notices.isEmpty()) {
                item { Text(stringResource(R.string.msg_updates_empty), style = MaterialTheme.typography.bodyLarge, color = Krevo.colors.textSecondary) }
            }
            notices.forEach { u -> item(key = "n-${u.id}") { NoticeRow(u, onClick = { open = u.detail(); vm.markNoticesRead() }) } }
            item { SectionLabel(stringResource(R.string.msg_teachers), modifier = Modifier.padding(top = 4.dp)) }
            if (data.teachers.isEmpty()) {
                item { Text(stringResource(R.string.msg_no_teachers), style = MaterialTheme.typography.bodyLarge, color = Krevo.colors.textSecondary) }
            }
            data.teachers.forEach { t -> item(key = t.id) { ThreadCard(t, onClick = { onOpenThread(t.id) }) } }
            if (data.previousTeachers.isNotEmpty()) {
                item { SectionLabel(stringResource(R.string.msg_previous), modifier = Modifier.padding(top = 4.dp)) }
                data.previousTeachers.forEach { t -> item(key = t.id) { ThreadCard(t, onClick = { onOpenThread(t.id) }) } }
            }
        }
    }
}

/** One notice: bold title, a line of the text, then who and when. A dot marks the ones not read yet. */
@Composable
private fun NoticeRow(u: Update, onClick: () -> Unit) {
    val c = Krevo.colors
    val d = u.detail()
    KrevoCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f)) {
                Text(d.title, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (d.body.isNotBlank() && d.body != d.title) {
                    Text(d.body, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
                }
                Text(
                    listOfNotNull(d.sender, Ist.dateOfInstant(d.at)).joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall, color = c.textTertiary, modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (!u.read) Box(Modifier.padding(start = 8.dp, top = 6.dp).size(10.dp).background(c.danger, CircleShape))
        }
    }
}

/** A teacher row. A previous teacher is greyed out and says "No longer teaches {Subject}". */
@Composable
private fun ThreadCard(t: TeacherThread, onClick: () -> Unit) {
    val c = Krevo.colors
    val tag = if (t.isClassTeacher) stringResource(R.string.msg_tag_class_teacher_subject, t.subject) else t.subject
    val description = when {
        !t.isActive -> stringResource(R.string.msg_previous_desc, t.teacher, t.subject, t.lastMessage)
        t.unread > 0 -> stringResource(R.string.msg_thread_desc_unread, t.teacher, tag, t.lastMessage)
        else -> stringResource(R.string.msg_thread_desc, t.teacher, tag, t.lastMessage)
    }
    val nameColor = if (t.isActive) c.text else c.textTertiary
    KrevoCard(
        onClick = onClick,
        modifier = Modifier
            .then(if (t.isActive) Modifier else Modifier.alpha(0.65f))
            .semantics(mergeDescendants = true) { contentDescription = description },
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(initials = initialsOf(t.teacher), size = 44.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(t.teacher, style = MaterialTheme.typography.titleMedium, color = nameColor)
                if (t.isActive) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 2.dp)) {
                        if (t.isClassTeacher) Chip(stringResource(R.string.class_teacher), background = c.solid, content = c.onSolid)
                        Chip(t.subject)
                    }
                } else {
                    Text(
                        stringResource(R.string.msg_no_longer, t.subject),
                        style = MaterialTheme.typography.bodySmall,
                        color = c.textTertiary,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Text(
                    t.lastMessage,
                    style = MaterialTheme.typography.bodyMedium,
                    color = c.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Column(horizontalAlignment = Alignment.End, modifier = Modifier.padding(start = 8.dp)) {
                Text(Ist.dateOfInstant(t.lastAt), style = MaterialTheme.typography.bodySmall, color = c.textTertiary)
                if (t.unread > 0 && t.isActive) {
                    Box(Modifier.padding(top = 6.dp).size(10.dp).background(c.danger, CircleShape))
                }
            }
        }
    }
}
