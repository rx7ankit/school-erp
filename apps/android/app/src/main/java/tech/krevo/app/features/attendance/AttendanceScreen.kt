package tech.krevo.app.features.attendance

import tech.krevo.app.design.AttendanceSkeleton
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
import tech.krevo.app.app.VmFactory
import tech.krevo.app.R
import tech.krevo.app.data.Repository
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoCard
import tech.krevo.app.design.KrevoList
import tech.krevo.app.design.ScreenHeader
import tech.krevo.app.design.loadContent
import tech.krevo.app.domain.AttendanceDay
import tech.krevo.app.domain.AttendanceMonth
import tech.krevo.app.domain.AttendanceStatus
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.Ist
import tech.krevo.app.domain.percent
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

    KrevoList {
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
        loadContent(state, onRetry = vm::load, skeleton = { AttendanceSkeleton() }) { data ->
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
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = stringResource(R.string.att_previous_month), tint = Krevo.colors.text)
        }
        Text(
            text = Ist.month(month),
            style = MaterialTheme.typography.titleLarge,
            color = Krevo.colors.text,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        IconButton(onClick = onNext, enabled = canGoNext, modifier = Modifier.size(48.dp)) {
            Icon(
                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = stringResource(R.string.att_next_month),
                tint = if (canGoNext) Krevo.colors.text else Krevo.colors.textTertiary,
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

    KrevoCard(contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp, vertical = 12.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            DayOfWeek.entries.forEach {
                Text(
                    text = Ist.narrowWeekday(it),
                    modifier = Modifier.weight(1f).clearAndSetSemantics { },
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelMedium,
                    color = Krevo.colors.textSecondary,
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
    val c = Krevo.colors
    val numberColor = when {
        isToday -> c.text
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
        // A soft circle tinted by the day's status, no border.
        val tint = when (day.status) {
            AttendanceStatus.PRESENT -> c.success
            AttendanceStatus.ABSENT -> c.danger
            AttendanceStatus.HALF_FIRST, AttendanceStatus.HALF_SECOND -> c.warning
            AttendanceStatus.LEAVE -> LeaveColor
            AttendanceStatus.HOLIDAY -> HolidayColor
            AttendanceStatus.NOT_MARKED -> null
        }
        Box(
            modifier = Modifier
                .size(38.dp)
                .background(tint?.copy(alpha = if (day.status == AttendanceStatus.HOLIDAY) 0.22f else 0.17f) ?: Color.Transparent, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = day.date.dayOfMonth.toString(),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                color = if (day.status == AttendanceStatus.HOLIDAY) c.textSecondary else numberColor,
            )
        }
    }
}

/** Leave days get a purple dot, holidays a quiet grey one. */
private val LeaveColor = Color(0xFF8E4BEC)
private val HolidayColor = Color(0xFFB0B0B8)

/** Legend circle: the same soft tint the calendar uses, a little stronger so it reads at small size. */
@Composable
private fun Swatch(color: Color) {
    Box(modifier = Modifier.size(12.dp).background(color.copy(alpha = 0.4f), CircleShape))
}

@Composable
private fun Legend() {
    val c = Krevo.colors
    @Composable
    fun item(marker: @Composable () -> Unit, label: String) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(end = 16.dp, bottom = 6.dp)) {
            Box(modifier = Modifier.size(12.dp), contentAlignment = Alignment.Center) { marker() }
            Spacer(Modifier.width(6.dp))
            Text(label, style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
        }
    }
    androidx.compose.foundation.layout.Column {
        Row {
            item({ Swatch(c.success) }, stringResource(R.string.att_today_present))
            item({ Swatch(c.danger) }, stringResource(R.string.att_legend_absent))
            item({ Swatch(LeaveColor) }, stringResource(R.string.att_legend_leave))
        }
        Row {
            item({ Swatch(c.warning) }, stringResource(R.string.att_legend_half_first))
            item({ Swatch(c.warning) }, stringResource(R.string.att_legend_half_second))
        }
        Row {
            item({ Swatch(HolidayColor) }, stringResource(R.string.att_legend_holidays))
        }
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
            color = Krevo.colors.textTertiary,
        )
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier = Modifier) {
    KrevoCard(modifier = modifier.semantics(mergeDescendants = true) { }) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary)
        Text(value, style = MaterialTheme.typography.headlineMedium, color = Krevo.colors.text)
    }
}
