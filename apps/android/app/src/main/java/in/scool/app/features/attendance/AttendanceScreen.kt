package `in`.scool.app.features.attendance

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.app.VmFactory
import `in`.scool.app.R
import `in`.scool.app.data.Repository
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.loadContent
import `in`.scool.app.domain.AttendanceDay
import `in`.scool.app.domain.AttendanceMonth
import `in`.scool.app.domain.AttendanceStatus
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.percent
import java.time.DayOfWeek
import java.time.YearMonth

@Composable
fun AttendanceScreen(child: Child, repository: Repository) {
    val vm: AttendanceViewModel = viewModel(
        key = "attendance-${child.id}",
        factory = VmFactory { AttendanceViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()
    val month by vm.month.collectAsStateWithLifecycle()

    ScoolList {
        item {
            ScreenHeader(
                ink = stringResource(R.string.att_title_ink),
                grey = stringResource(R.string.att_title_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className),
            )
        }
        item {
            MonthSwitcher(month = month, canGoNext = vm.canGoNext, onPrevious = vm::previous, onNext = vm::next)
        }
        loadContent(state, onRetry = vm::load) { data ->
            item { CalendarCard(data) }
            item { Legend() }
            item { Stats(data) }
        }
    }
}

@Composable
private fun MonthSwitcher(month: YearMonth, canGoNext: Boolean, onPrevious: () -> Unit, onNext: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        IconButton(onClick = onPrevious, modifier = Modifier.size(48.dp)) {
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = stringResource(R.string.att_previous_month), tint = Scool.colors.text)
        }
        Text(
            text = Ist.month(month),
            style = MaterialTheme.typography.titleLarge,
            color = Scool.colors.text,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        IconButton(onClick = onNext, enabled = canGoNext, modifier = Modifier.size(48.dp)) {
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = stringResource(R.string.att_next_month),
                tint = if (canGoNext) Scool.colors.text else Scool.colors.textTertiary,
            )
        }
    }
}

@Composable
private fun CalendarCard(data: AttendanceMonth) {
    val first = YearMonth.parse(data.month).atDay(1)
    val blanks = first.dayOfWeek.value - 1 // Monday = 1
    val cells: List<AttendanceDay?> = List(blanks) { null } + data.days
    val weeks = cells.chunked(7)
    val today = Ist.today()

    ScoolCard(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 12.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            DayOfWeek.entries.forEach {
                Text(
                    text = Ist.narrowWeekday(it),
                    modifier = Modifier.weight(1f).clearAndSetSemantics { },
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelMedium,
                    color = Scool.colors.textSecondary,
                )
            }
        }
        weeks.forEach { week ->
            Row(modifier = Modifier.fillMaxWidth()) {
                for (i in 0 until 7) {
                    val day = week.getOrNull(i)
                    DayCell(day = day, isToday = day?.date == today, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun statusWord(s: AttendanceStatus): String = stringResource(
    when (s) {
        AttendanceStatus.PRESENT -> R.string.att_word_present
        AttendanceStatus.ABSENT -> R.string.att_word_absent
        AttendanceStatus.HALF_FIRST -> R.string.att_word_half_first
        AttendanceStatus.HALF_SECOND -> R.string.att_word_half_second
        AttendanceStatus.LEAVE -> R.string.att_word_leave
        AttendanceStatus.HOLIDAY -> R.string.att_word_holiday
        AttendanceStatus.NOT_MARKED -> R.string.att_word_not_marked
    },
)

@Composable
private fun DayCell(day: AttendanceDay?, isToday: Boolean, modifier: Modifier = Modifier) {
    if (day == null) {
        Box(modifier = modifier.heightIn(min = 48.dp))
        return
    }
    val c = Scool.colors
    val numberColor = when {
        isToday -> c.accent
        day.status == AttendanceStatus.HOLIDAY -> c.textTertiary
        day.status == AttendanceStatus.NOT_MARKED -> c.textSecondary
        else -> c.text
    }
    val description = if (isToday) {
        stringResource(R.string.att_day_desc_today, Ist.longDate(day.date), statusWord(day.status))
    } else {
        stringResource(R.string.att_day_desc, Ist.longDate(day.date), statusWord(day.status))
    }
    Box(
        modifier = modifier
            .heightIn(min = 48.dp)
            .semantics(mergeDescendants = true) { contentDescription = description },
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.foundation.layout.Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = day.date.dayOfMonth.toString(),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                color = numberColor,
            )
            Box(modifier = Modifier.padding(top = 3.dp).size(9.dp), contentAlignment = Alignment.Center) {
                Marker(day.status)
            }
        }
    }
}

@Composable
private fun Marker(status: AttendanceStatus) {
    val c = Scool.colors
    when (status) {
        AttendanceStatus.ABSENT -> Dot(c.danger)
        AttendanceStatus.LEAVE -> Dot(c.textTertiary)
        AttendanceStatus.HALF_FIRST -> HalfDot(c.warning, firstHalf = true)
        AttendanceStatus.HALF_SECOND -> HalfDot(c.warning, firstHalf = false)
        else -> Unit
    }
}

@Composable
private fun Dot(color: Color) {
    Box(modifier = Modifier.size(7.dp).background(color, CircleShape))
}

/** Half-filled dot: left half = first half of the day, right half = second half. */
@Composable
private fun HalfDot(color: Color, firstHalf: Boolean) {
    Canvas(modifier = Modifier.size(9.dp)) {
        val stroke = 1.2.dp.toPx()
        drawCircle(color = color, radius = (size.minDimension - stroke) / 2f, style = Stroke(width = stroke))
        drawArc(
            color = color,
            startAngle = if (firstHalf) 90f else 270f,
            sweepAngle = 180f,
            useCenter = true,
            topLeft = Offset(stroke / 2f, stroke / 2f),
            size = Size(size.width - stroke, size.height - stroke),
        )
    }
}

@Composable
private fun Legend() {
    val c = Scool.colors
    @Composable
    fun item(marker: @Composable () -> Unit, label: String) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(end = 16.dp, bottom = 6.dp)) {
            Box(modifier = Modifier.size(10.dp), contentAlignment = Alignment.Center) { marker() }
            Spacer(Modifier.width(6.dp))
            Text(label, style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
        }
    }
    androidx.compose.foundation.layout.Column {
        Row {
            item({ Dot(c.danger) }, stringResource(R.string.att_legend_absent))
            item({ HalfDot(c.warning, true) }, stringResource(R.string.att_legend_half_first))
        }
        Row {
            item({ HalfDot(c.warning, false) }, stringResource(R.string.att_legend_half_second))
            item({ Dot(c.textTertiary) }, stringResource(R.string.att_legend_leave))
        }
        Text(stringResource(R.string.att_legend_holidays), style = MaterialTheme.typography.bodySmall, color = c.textTertiary)
    }
}

@Composable
private fun Stats(data: AttendanceMonth) {
    val pct = data.percent?.let { percent(it) } ?: "-"
    androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(stringResource(R.string.att_stat_attendance), pct, Modifier.weight(1f))
            StatCard(stringResource(R.string.att_stat_present), data.presentDays.toString(), Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(stringResource(R.string.att_stat_absent), data.absentDays.toString(), Modifier.weight(1f))
            StatCard(stringResource(R.string.att_stat_half), data.halfDays.toString(), Modifier.weight(1f))
        }
        Text(
            stringResource(R.string.att_half_note),
            style = MaterialTheme.typography.bodySmall,
            color = Scool.colors.textTertiary,
        )
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    ScoolCard(modifier = modifier.semantics(mergeDescendants = true) { }) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Scool.colors.textSecondary)
        Text(value, style = MaterialTheme.typography.headlineMedium, color = Scool.colors.text)
    }
}
