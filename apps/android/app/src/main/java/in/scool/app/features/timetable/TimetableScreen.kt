package `in`.scool.app.features.timetable

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.R
import `in`.scool.app.app.VmFactory
import `in`.scool.app.data.Repository
import `in`.scool.app.design.Radius
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.loadContent
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.Period
import `in`.scool.app.domain.Timetable
import java.time.DayOfWeek

private val periodColumn = 92.dp
private val dayColumn = 116.dp
private val days = DayOfWeek.entries.filter { it != DayOfWeek.SUNDAY }

@Composable
fun TimetableScreen(child: Child, repository: Repository, onBack: () -> Unit) {
    val vm: TimetableViewModel = viewModel(
        key = "timetable-${child.id}",
        factory = VmFactory { TimetableViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()

    ScoolList {
        item {
            ScreenHeader(
                ink = stringResource(R.string.tt_title_ink),
                grey = stringResource(R.string.tt_title_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className),
                onBack = onBack,
            )
        }
        loadContent(state, onRetry = vm::load) { tt -> item { Grid(tt) } }
    }
}

/** Monday to Saturday across, periods down. Scrolls sideways on narrow screens; today's column is highlighted. */
@Composable
private fun Grid(tt: Timetable) {
    val today = Ist.today()
    Column(modifier = Modifier.horizontalScroll(rememberScrollState())) {
        Row {
            Box(Modifier.width(periodColumn))
            days.forEach { day -> DayHeader(day, isToday = day == today.dayOfWeek) }
        }
        tt.periods.forEach { p ->
            Row(modifier = Modifier.height(IntrinsicSize.Min).padding(top = 4.dp)) {
                PeriodLabel(p)
                if (p.isBreak) {
                    Cell(
                        width = dayColumn * days.size,
                        highlighted = false,
                        description = stringResource(R.string.tt_break_desc, Ist.clock(p.start), Ist.clock(p.end)),
                    ) {
                        Text(
                            stringResource(R.string.tt_break),
                            style = MaterialTheme.typography.titleSmall,
                            color = Scool.colors.textSecondary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxHeight(),
                        )
                    }
                } else {
                    days.forEach { day -> SlotCell(tt, p, day, isToday = day == today.dayOfWeek, today = today) }
                }
            }
        }
    }
}

@Composable
private fun DayHeader(day: DayOfWeek, isToday: Boolean) {
    val c = Scool.colors
    val name = Ist.dayName(day)
    val description = if (isToday) stringResource(R.string.tt_today_desc, Ist.dayName(day, full = true)) else Ist.dayName(day, full = true)
    Box(
        modifier = Modifier
            .width(dayColumn)
            .padding(horizontal = 2.dp)
            .heightIn(min = 40.dp)
            .background(if (isToday) c.solid else c.bg, RoundedCornerShape(Radius.control))
            .semantics(mergeDescendants = true) { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        Text(name, style = MaterialTheme.typography.titleSmall, color = if (isToday) c.onSolid else c.text)
    }
}

@Composable
private fun PeriodLabel(p: Period) {
    Column(modifier = Modifier.width(periodColumn).padding(end = 6.dp).fillMaxHeight()) {
        Text(
            if (p.no != null) stringResource(R.string.tt_period, p.no) else stringResource(R.string.tt_break),
            style = MaterialTheme.typography.titleSmall,
            color = Scool.colors.text,
        )
        Text(Ist.clock(p.start), style = MaterialTheme.typography.bodySmall, color = Scool.colors.textSecondary)
        Text(Ist.clock(p.end), style = MaterialTheme.typography.bodySmall, color = Scool.colors.textSecondary)
    }
}

@Composable
private fun SlotCell(tt: Timetable, p: Period, day: DayOfWeek, isToday: Boolean, today: java.time.LocalDate) {
    val c = Scool.colors
    val slot = tt.slot(day, p.index)
    val cover = if (isToday) tt.substitution(today, p.index) else null
    val dayName = Ist.dayName(day, full = true)
    val periodName = stringResource(R.string.tt_period, p.no ?: 0)
    val times = stringResource(R.string.tt_times, Ist.clock(p.start), Ist.clock(p.end))
    val description = when {
        slot == null -> stringResource(R.string.tt_free_desc, dayName, periodName, times)
        cover != null -> stringResource(R.string.tt_sub_desc, dayName, periodName, times, slot.subject, cover.teacher)
        else -> stringResource(R.string.tt_cell_desc, dayName, periodName, times, slot.subject, slot.teacher)
    }
    Cell(width = dayColumn, highlighted = isToday, description = description) {
        if (slot == null) {
            Text(stringResource(R.string.tt_free), style = MaterialTheme.typography.bodySmall, color = c.textTertiary)
        } else {
            Column {
                Text(slot.subject, style = MaterialTheme.typography.titleSmall, color = c.text)
                if (cover != null) {
                    Text(stringResource(R.string.tt_substitute, cover.teacher), style = MaterialTheme.typography.bodySmall, color = c.warning)
                } else {
                    Text(slot.teacher, style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
                }
            }
        }
    }
}

@Composable
private fun Cell(width: Dp, highlighted: Boolean, description: String, content: @Composable () -> Unit) {
    val c = Scool.colors
    Box(
        modifier = Modifier
            .width(width)
            .padding(horizontal = 2.dp)
            .fillMaxHeight()
            .heightIn(min = 64.dp)
            .background(if (highlighted) c.fill else c.card, RoundedCornerShape(Radius.control))
            .padding(8.dp)
            .semantics(mergeDescendants = true) { contentDescription = description },
    ) { content() }
}
