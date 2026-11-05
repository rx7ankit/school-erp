package tech.krevo.app.features.attendance

import tech.krevo.app.design.AttendanceSkeleton
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.items
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.async
import kotlinx.coroutines.launch
import tech.krevo.app.app.toUiText
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.animation.animateContentSize
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

/** The Attendance tab: the academic year at a glance, then month by month. The current month starts open, the rest closed. */
@Composable
fun AttendanceScreen(child: Child, repository: Repository) {
    YearAttendanceScreen(child, repository)
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
    var tip by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    Box(
        modifier = modifier
            .heightIn(min = 48.dp)
            .semantics(mergeDescendants = true) { contentDescription = description }
            .then(
                if (day.status == AttendanceStatus.NOT_MARKED) Modifier
                else Modifier.clickable(
                    interactionSource = androidx.compose.runtime.remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
                    indication = null,
                ) { tip = true },
            ),
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
        // A small bubble naming the day's status, so nobody has to guess what a colour means.
        androidx.compose.material3.DropdownMenu(expanded = tip, onDismissRequest = { tip = false }) {
            androidx.compose.foundation.layout.Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text(statusWord(day.status), style = MaterialTheme.typography.titleSmall, color = tint ?: c.text)
                Text(Ist.longDate(day.date), style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
            }
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

// ---- year view ------------------------------------------------------------------------------------------------------

private data class MonthRow(val month: YearMonth, val data: AttendanceMonth)

private data class YearData(val label: String, val rows: List<MonthRow>, val data: AttendanceMonth)

private class YearAttendanceViewModel(private val repository: Repository, private val childId: String) : androidx.lifecycle.ViewModel() {
    private val _state = kotlinx.coroutines.flow.MutableStateFlow<tech.krevo.app.domain.Load<YearData>>(tech.krevo.app.domain.Load.Loading)
    val state: kotlinx.coroutines.flow.StateFlow<tech.krevo.app.domain.Load<YearData>> = _state

    init { load() }

    fun load() {
        viewModelScope.launch {
            try {
                _state.value = tech.krevo.app.domain.Load.Data(build())
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                if (_state.value !is tech.krevo.app.domain.Load.Data) _state.value = tech.krevo.app.domain.Load.Error(e.toUiText())
            }
        }
    }

    /** Academic years run April to March. Months with nothing marked are left out, apart from the current one. */
    private suspend fun build(): YearData = kotlinx.coroutines.coroutineScope {
        val now = YearMonth.from(Ist.today())
        val startYear = if (now.monthValue >= 4) now.year else now.year - 1
        val months = generateSequence(YearMonth.of(startYear, 4)) { it.plusMonths(1) }.takeWhile { !it.isAfter(now) }.toList()
        val loaded = months.map { m -> async { MonthRow(m, repository.attendanceMonth(childId, m.toString())) } }.map { it.await() }
        val rows = loaded.filter { r -> r.data.presentDays + r.data.absentDays + r.data.halfDays + r.data.leaveDays > 0 || r.month == now }
        YearData("$startYear-${(startYear + 1) % 100}".replace(Regex("-(\\d)$"), "-0$1"), rows, AttendanceMonth("year", loaded.flatMap { it.data.days }))
    }
}

@Composable
private fun YearAttendanceScreen(child: Child, repository: Repository) {
    val vm: YearAttendanceViewModel = viewModel(key = "year-attendance-${child.id}", factory = VmFactory { YearAttendanceViewModel(repository, child.id) })
    val state by vm.state.collectAsStateWithLifecycle()
    KrevoList {
        item {
            Text(
                stringResource(R.string.att_title, child.firstName), style = MaterialTheme.typography.headlineLarge,
                color = Krevo.colors.text, modifier = Modifier.padding(vertical = 8.dp),
            )
        }
        loadContent(state, onRetry = vm::load, skeleton = { AttendanceSkeleton() }) { year ->
            item { YearCard(year) }
            item { Text(stringResource(R.string.att_by_month).uppercase(), style = MaterialTheme.typography.labelMedium, color = Krevo.colors.textSecondary) }
            item { Legend() }
            items(year.rows.reversed(), key = { it.month.toString() }) { row -> MonthRowCard(row, startOpen = row.month == YearMonth.from(Ist.today())) }
        }
    }
}

private fun total(d: AttendanceMonth) = d.presentDays + d.absentDays + d.halfDays + d.leaveDays

@Composable
private fun YearCard(year: YearData) {
    val c = Krevo.colors
    val d = year.data
    KrevoCard {
        Text(stringResource(R.string.att_this_year, year.label).uppercase(), style = MaterialTheme.typography.labelMedium, color = c.textSecondary)
        if (total(d) == 0) {
            Text(stringResource(R.string.att_no_marks), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(top = 8.dp))
        } else {
            Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(top = 8.dp)) {
                Text(percent(d.percent ?: 0.0), style = MaterialTheme.typography.displaySmall, color = c.text)
                Text(stringResource(R.string.att_school_days, total(d)), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(start = 8.dp, bottom = 6.dp))
            }
            Bar((d.percent ?: 0.0) / 100.0, c.success, Modifier.padding(top = 12.dp))
            Row(Modifier.fillMaxWidth().padding(top = 16.dp)) {
                YearStat(d.presentDays.toString(), stringResource(R.string.att_present_short), c.success, Modifier.weight(1f))
                YearStat(d.absentDays.toString(), stringResource(R.string.att_absent_short), c.danger, Modifier.weight(1f))
                YearStat(d.halfDays.toString(), stringResource(R.string.att_half_short), c.warning, Modifier.weight(1f))
                YearStat(d.leaveDays.toString(), stringResource(R.string.att_leave_short), LeaveColor, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun YearStat(value: String, label: String, tint: Color, modifier: Modifier) {
    androidx.compose.foundation.layout.Column(modifier) {
        Text(value, style = MaterialTheme.typography.titleLarge, color = tint)
        Text(label, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary)
    }
}

@Composable
private fun Bar(fraction: Double, tint: Color, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(6.dp).background(Krevo.colors.fill, CircleShape)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0.0, 1.0).toFloat().coerceAtLeast(0.02f)).height(6.dp).background(tint, CircleShape))
    }
}

@Composable
private fun MonthRowCard(row: MonthRow, startOpen: Boolean) {
    val c = Krevo.colors
    val d = row.data
    var open by androidx.compose.runtime.saveable.rememberSaveable(row.month.toString()) { androidx.compose.runtime.mutableStateOf(startOpen) }
    val rotation by androidx.compose.animation.core.animateFloatAsState(
        if (open) 90f else 0f, androidx.compose.animation.core.tween(350, easing = androidx.compose.animation.core.FastOutSlowInEasing), label = "chevron",
    )
    KrevoCard(onClick = { open = !open }) {
        // One column animates its own height, so the card and everything below it glide together.
        androidx.compose.foundation.layout.Column(
            Modifier.animateContentSize(androidx.compose.animation.core.tween(350, easing = androidx.compose.animation.core.FastOutSlowInEasing)),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(Ist.month(row.month), style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
                Text(if (total(d) == 0) "–" else percent(d.percent ?: 0.0), style = MaterialTheme.typography.titleMedium, color = c.text)
            }
            if (total(d) > 0) Bar((d.percent ?: 0.0) / 100.0, c.success, Modifier.padding(top = 10.dp))
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                val summary = if (total(d) == 0) stringResource(R.string.att_no_marks) else buildList {
                    add("${d.presentDays} ${stringResource(R.string.att_present_short).lowercase()}")
                    add("${d.absentDays} ${stringResource(R.string.att_absent_short).lowercase()}")
                    if (d.halfDays > 0) add("${d.halfDays} ${stringResource(R.string.att_half_short).lowercase()}")
                    if (d.leaveDays > 0) add("${d.leaveDays} ${stringResource(R.string.att_leave_short).lowercase()}")
                }.joinToString(" · ")
                Text(summary, style = MaterialTheme.typography.bodySmall, color = c.textSecondary, modifier = Modifier.weight(1f))
                // The arrow sits at the bottom right of the header, under the percentage.
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = Ist.month(row.month), tint = c.textTertiary,
                    modifier = Modifier.size(20.dp).rotate(rotation),
                )
            }
            if (open) {
                androidx.compose.foundation.layout.Column(Modifier.padding(top = 12.dp)) { MonthCalendar(d) }
            }
        }
    }
}

/** The month's day circles, without a card around them (the month row already is one). */
@Composable
private fun MonthCalendar(data: AttendanceMonth) {
    val first = YearMonth.parse(data.month).atDay(1)
    val blanks = first.dayOfWeek.value - 1 // Monday = 1
    val cells: List<AttendanceDay?> = List(blanks) { null } + data.days
    val today = Ist.today()
    Row(modifier = Modifier.fillMaxWidth()) {
        DayOfWeek.entries.forEach {
            Text(
                text = Ist.narrowWeekday(it), modifier = Modifier.weight(1f).clearAndSetSemantics { },
                textAlign = TextAlign.Center, style = MaterialTheme.typography.labelMedium, color = Krevo.colors.textSecondary,
            )
        }
    }
    cells.chunked(7).forEach { week ->
        Row(modifier = Modifier.fillMaxWidth()) {
            for (i in 0 until 7) {
                val day = week.getOrNull(i)
                DayCell(day = day, isToday = day?.date == today, modifier = Modifier.weight(1f))
            }
        }
    }
}
