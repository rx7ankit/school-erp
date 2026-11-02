package tech.slov.app.features.notices

import androidx.compose.ui.res.stringResource
import tech.slov.app.R
import androidx.compose.ui.platform.LocalContext
import tech.slov.app.domain.Child
import tech.slov.app.domain.ExamSchedule
import androidx.compose.material3.HorizontalDivider
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
import tech.slov.app.app.VmFactory
import tech.slov.app.data.Repository
import tech.slov.app.design.Chip
import tech.slov.app.design.Slov
import tech.slov.app.design.SlovCard
import tech.slov.app.design.SlovList
import tech.slov.app.design.ScreenHeader
import tech.slov.app.design.SegmentedControl
import tech.slov.app.design.loadContent
import tech.slov.app.domain.CalendarEvent
import tech.slov.app.domain.EventKind
import tech.slov.app.domain.Ist
import tech.slov.app.domain.Notice

@Composable
fun NoticesScreen(child: Child, repository: Repository, initialTab: Int = 0, onBack: () -> Unit) {
    val vm: NoticesViewModel = viewModel(
        key = "notices-${child.id}",
        factory = VmFactory { NoticesViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableStateOf(initialTab) }
    val resources = LocalContext.current.resources

    SlovList {
        item { ScreenHeader(ink = stringResource(R.string.notices_title_ink), grey = stringResource(R.string.notices_title_grey), onBack = onBack) }
        item { SegmentedControl(
                options = listOf(
                    stringResource(R.string.notices_tab_notices),
                    stringResource(R.string.notices_tab_calendar),
                    stringResource(R.string.notices_tab_exams),
                ),
                selectedIndex = tab,
                onSelect = { tab = it },
            ) }
        loadContent(state, onRetry = vm::load) { data ->
            when (tab) {
                0 -> {
                    if (data.notices.isEmpty()) item { Empty(stringResource(R.string.notices_empty)) }
                    data.notices.forEach { n -> item(key = n.id) { NoticeCard(n) } }
                }
                1 -> {
                    if (data.events.isEmpty()) item { Empty(stringResource(R.string.calendar_empty)) }
                    data.events.forEach { e -> item(key = e.id) { EventCard(e) } }
                }
                else -> {
                    if (data.schedules.isEmpty()) item { Empty(stringResource(R.string.exams_empty)) }
                    data.schedules.forEach { s -> item(key = s.id) { ExamScheduleCard(s, resources.getQuantityString(R.plurals.exam_papers, s.papers.size, s.papers.size)) } }
                }
            }
        }
    }
}

@Composable
private fun Empty(text: String) {
    Text(text, style = MaterialTheme.typography.bodyLarge, color = Slov.colors.textSecondary)
}

@Composable
private fun NoticeCard(n: Notice) {
    SlovCard {
        Text(n.title, style = MaterialTheme.typography.titleLarge, color = Slov.colors.text)
        Text(
            Ist.dateTime(n.publishedAt),
            style = MaterialTheme.typography.bodySmall,
            color = Slov.colors.textSecondary,
            modifier = Modifier.padding(top = 2.dp),
        )
        Text(n.body, style = MaterialTheme.typography.bodyLarge, color = Slov.colors.text, modifier = Modifier.padding(top = 8.dp))
    }
}

@Composable
private fun EventCard(e: CalendarEvent) {
    val c = Slov.colors
    val (label, color) = when (e.kind) {
        EventKind.HOLIDAY -> stringResource(R.string.event_holiday) to c.success
        EventKind.EXAM -> stringResource(R.string.event_exam) to c.warning
        EventKind.EVENT -> stringResource(R.string.event_event) to c.textSecondary
    }
    SlovCard {
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

/** One exam with its date sheet: subject, weekday, date and start time, all in IST. */
@Composable
private fun ExamScheduleCard(s: ExamSchedule, papersText: String) {
    val c = Slov.colors
    SlovCard {
        Text(s.name, style = MaterialTheme.typography.titleLarge, color = c.text)
        Text(
            "${Ist.range(s.fromOn, s.toOn)} · $papersText",
            style = MaterialTheme.typography.bodyMedium,
            color = c.textSecondary,
            modifier = Modifier.padding(top = 2.dp),
        )
        s.papers.forEach { p ->
            HorizontalDivider(color = c.separator, modifier = Modifier.padding(top = 12.dp))
            Text(p.subject, style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.padding(top = 12.dp))
            Text(
                "${Ist.weekdayOfInstant(p.startsAt)}, ${Ist.dateOfInstant(p.startsAt)}",
                style = MaterialTheme.typography.bodyMedium,
                color = c.textSecondary,
            )
            Text(
                stringResource(R.string.exams_starts_at, Ist.time(p.startsAt)),
                style = MaterialTheme.typography.bodyMedium,
                color = c.textSecondary,
            )
        }
    }
}
