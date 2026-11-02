package tech.krevo.app.features.messages

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import tech.krevo.app.R
import tech.krevo.app.app.VmFactory
import tech.krevo.app.data.Repository
import tech.krevo.app.design.Chip
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoCard
import tech.krevo.app.design.KrevoList
import tech.krevo.app.design.ScreenHeader
import tech.krevo.app.design.loadContent
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.Ist
import tech.krevo.app.domain.Update
import tech.krevo.app.domain.UpdateKind

/** The unified feed: school and class broadcasts, newest first. Read-only, there is no reply here. */
@Composable
fun UpdatesScreen(child: Child, repository: Repository, onBack: () -> Unit) {
    val vm: UpdatesViewModel = viewModel(
        key = "updates-${child.id}",
        factory = VmFactory { UpdatesViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()
    val filter by vm.filter.collectAsStateWithLifecycle()

    KrevoList {
        item {
            ScreenHeader(
                ink = stringResource(R.string.updates_title_ink),
                grey = stringResource(R.string.updates_title_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className),
                onBack = onBack,
            )
        }
        loadContent(state, onRetry = vm::load) { all ->
            item {
                val options = listOf<UpdateFilter>(UpdateFilter.All, UpdateFilter.School) + all.subjects().map { UpdateFilter.Subject(it) }
                FilterChips(
                    labels = options.map {
                        when (it) {
                            UpdateFilter.All -> stringResource(R.string.msg_filter_all)
                            UpdateFilter.School -> stringResource(R.string.msg_tag_school)
                            is UpdateFilter.Subject -> it.name
                        }
                    },
                    selectedIndex = options.indexOf(filter),
                    onSelect = { vm.select(options[it]) },
                )
            }
            val shown = all.matching(filter)
            if (shown.isEmpty()) {
                item { Text(stringResource(R.string.msg_updates_empty), style = MaterialTheme.typography.bodyLarge, color = Krevo.colors.textSecondary) }
            }
            shown.forEach { u -> item(key = u.id) { UpdateCard(u) } }
        }
    }
}

/** Filter row: All, School, then each subject. Selected chip is black/white, the rest grey. */
@Composable
private fun FilterChips(labels: List<String>, selectedIndex: Int, onSelect: (Int) -> Unit) {
    val c = Krevo.colors
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        labels.forEachIndexed { index, label ->
            val selected = index == selectedIndex
            Surface(
                modifier = Modifier
                    .heightIn(min = 48.dp)
                    .selectable(selected = selected, role = Role.Tab, onClick = { onSelect(index) }),
                shape = CircleShape,
                color = if (selected) c.solid else c.card,
                tonalElevation = 0.dp,
                shadowElevation = 0.dp,
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 16.dp)) {
                    Text(label, style = MaterialTheme.typography.labelLarge, color = if (selected) c.onSolid else c.text)
                }
            }
        }
    }
}

@Composable
private fun UpdateCard(u: Update) {
    val c = Krevo.colors
    val tag = when {
        u.kind == UpdateKind.SCHOOL -> stringResource(R.string.msg_tag_school)
        u.subject != null -> u.subject
        else -> stringResource(R.string.msg_tag_general)
    }
    val unreadText = stringResource(R.string.msg_unread_state)
    KrevoCard(modifier = if (u.read) Modifier else Modifier.semantics { stateDescription = unreadText }) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                if (!u.read) {
                    Box(Modifier.size(10.dp).background(c.danger, CircleShape))
                    Spacer(Modifier.width(8.dp))
                }
                Text(u.sender, style = MaterialTheme.typography.titleSmall, color = c.text)
            }
            Chip(tag, modifier = Modifier.padding(start = 8.dp))
        }
        Text(u.text, style = MaterialTheme.typography.bodyLarge, color = c.text, modifier = Modifier.padding(top = 8.dp))
        if (u.attachment != null) {
            Chip(
                text = stringResource(R.string.msg_attachment, u.attachment),
                modifier = Modifier.padding(top = 10.dp),
                background = c.bg,
            )
        }
        Text(Ist.dateTime(u.at), style = MaterialTheme.typography.bodySmall, color = c.textSecondary, modifier = Modifier.padding(top = 8.dp))
    }
}
