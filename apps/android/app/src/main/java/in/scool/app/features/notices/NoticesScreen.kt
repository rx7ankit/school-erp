package `in`.scool.app.features.notices

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.app.VmFactory
import `in`.scool.app.data.Repository
import `in`.scool.app.design.Chip
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.SegmentedControl
import `in`.scool.app.design.loadContent
import `in`.scool.app.domain.CalendarEvent
import `in`.scool.app.domain.EventKind
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.Notice

@Composable
fun NoticesScreen(repository: Repository, onBack: () -> Unit) {
    val vm: NoticesViewModel = viewModel(factory = VmFactory { NoticesViewModel(repository) })
    val state by vm.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(0) }

    ScoolList {
        item { ScreenHeader(ink = "Notices.", grey = "And the school calendar.", onBack = onBack) }
        item { SegmentedControl(options = listOf("Notices", "Calendar"), selectedIndex = tab, onSelect = { tab = it }) }
        loadContent(state, onRetry = vm::load) { data ->
            if (tab == 0) {
                if (data.notices.isEmpty()) item { Empty("No notices.") }
                data.notices.forEach { n -> item(key = n.id) { NoticeCard(n) } }
            } else {
                if (data.events.isEmpty()) item { Empty("Nothing on the calendar.") }
                data.events.forEach { e -> item(key = e.id) { EventCard(e) } }
            }
        }
    }
}

@Composable
private fun Empty(text: String) {
    Text(text, style = MaterialTheme.typography.bodyLarge, color = Scool.colors.textSecondary)
}

@Composable
private fun NoticeCard(n: Notice) {
    ScoolCard {
        Text(n.title, style = MaterialTheme.typography.titleLarge, color = Scool.colors.text)
        Text(
            Ist.dateTime(n.publishedAt),
            style = MaterialTheme.typography.bodySmall,
            color = Scool.colors.textSecondary,
            modifier = Modifier.padding(top = 2.dp),
        )
        Text(n.body, style = MaterialTheme.typography.bodyLarge, color = Scool.colors.text, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun EventCard(e: CalendarEvent) {
    val c = Scool.colors
    val (label, color) = when (e.kind) {
        EventKind.HOLIDAY -> "Holiday" to c.success
        EventKind.EXAM -> "Exam" to c.warning
        EventKind.EVENT -> "Event" to c.textSecondary
    }
    ScoolCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(e.title, style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
            Chip(label, background = color.copy(alpha = 0.14f), content = color)
        }
        Text(
            Ist.range(e.fromOn, e.toOn),
            style = MaterialTheme.typography.bodyMedium,
            color = c.textSecondary,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
