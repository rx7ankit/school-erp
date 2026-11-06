package tech.krevo.app.features.staff

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import tech.krevo.app.data.staff.AttendanceInsight
import tech.krevo.app.data.staff.DayEntry
import tech.krevo.app.data.staff.FeesSummary
import tech.krevo.app.data.staff.StaffDashboard
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.PillButton
import kotlin.math.roundToInt

/** Everything the Home tab loads, in parallel. The charts and fees are optional extras: they never block the page. */
private class HomeData(val dashboard: StaffDashboard, val day: List<DayEntry>, val insight: AttendanceInsight?, val fees: FeesSummary?)

@Composable
internal fun StaffHomeScreen(go: (StaffTab) -> Unit) {
    val staff = LocalStaff.current
    val first = staff.me.name.split(' ').firstOrNull().orEmpty()
    val loader = rememberLoader(staff) {
        coroutineScope {
            val d = async { staff.repo.dashboard() }
            val day = async { staff.repo.myDay(StaffDates.today()) }
            val insight = async { runCatching { staff.repo.attendanceInsight(14) }.getOrNull() }
            val fees = async { if (staff.me.canSeeFees) runCatching { staff.repo.feesSummary() }.getOrNull() else null }
            HomeData(d.await(), day.await(), insight.await(), fees.await())
        }
    }
    LaunchedEffect(staff) { staff.refreshPendingLeaves() }

    StaffPage(ink = "Hi, $first.", grey = StaffDates.weekday(StaffDates.today()) + ".", showTitle = false) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill(staff.me.roleTitle, color = Krevo.colors.text)
            staff.me.schoolName?.let { Pill(it) }
        }
        Loaded(loader) { data ->
            val d = data.dashboard
            StatGrid(d)

            if (staff.me.canMarkAttendance && d.classesMarkedToday < d.classesTotal) {
                PillButton(text = "Mark today's attendance", onClick = { go(StaffTab.ATTENDANCE) }, kind = ButtonKind.BRAND, modifier = Modifier.fillMaxWidth())
            }
            if (staff.pendingLeaves > 0) {
                TapCard(onClick = { go(StaffTab.LEAVE) }) {
                    val n = staff.pendingLeaves
                    Text(
                        "$n leave ${if (n == 1) "request needs" else "requests need"} your decision",
                        style = MaterialTheme.typography.titleSmall, color = Krevo.colors.text,
                    )
                }
            }
            data.insight?.let { AttendanceTrendCard(it) }
            data.fees?.takeIf { it.billedPaise > 0 }?.let { FeesRingCard(it) }

            SmallLabel("Your day")
            if (data.day.isEmpty()) EmptyNote("No classes scheduled today.") else data.day.forEach { PeriodRow(it) }
        }
    }
}

@Composable
private fun StatGrid(d: StaffDashboard) {
    val tiles = buildList<Triple<String, String, String?>> {
        add(Triple("Students", d.students.toString(), "${d.classes} ${if (d.classes == 1) "class" else "classes"}"))
        add(Triple("Attendance today", percent(d.todayPercentage), "${d.classesMarkedToday} of ${d.classesTotal} classes marked"))
        d.fees?.let {
            add(Triple("Collected this month", rupees(it.collectedThisMonthPaise), "${rupees(it.duesPaise)} dues"))
            add(Triple("Overdue", rupees(it.overduePaise), "${it.duesStudents} students owe fees"))
        }
        d.staff?.let { add(Triple("Staff present", "${it.presentToday}/${it.activeStaff}", if (it.notMarkedToday > 0) "${it.notMarkedToday} not marked" else null)) }
        if (d.fees == null && d.staff == null) add(Triple("This month", percent(d.monthPercentage), "Attendance"))
        d.resultExam?.let { add(Triple("Average marks", percent(d.resultAverage), it)) }
    }
    tiles.chunked(2).forEach { row ->
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            row.forEach { (label, value, hint) ->
                StatTile(label, value, hint = hint, danger = label == "Overdue", modifier = Modifier.weight(1f).fillMaxWidth())
            }
            if (row.size == 1) Box(Modifier.weight(1f))
        }
    }
}

/** One period of the day: time, subject, class. */
@Composable
internal fun PeriodRow(e: DayEntry) {
    FlatCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.width(84.dp)) {
                Text(StaffDates.clock(e.startsAt), style = MaterialTheme.typography.titleSmall, color = Krevo.colors.text)
                Text(e.periodName, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary)
            }
            Column(Modifier.weight(1f)) {
                Text(e.subjectName, style = MaterialTheme.typography.titleMedium, color = Krevo.colors.text)
                Text("Class ${e.classLabel}", style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary)
            }
            if (e.substituteName != null) ToneChip("Cover", Krevo.colors.warning)
            else if (e.role == "substitute") ToneChip("Substitute", Krevo.colors.text)
        }
    }
}

/** Attendance over the last two weeks as a soft area line. The last day is called out. */
@Composable
private fun AttendanceTrendCard(insight: AttendanceInsight) {
    val c = Krevo.colors
    val points = insight.trend.mapNotNull { t -> t.percentage?.let { t.dayOn to it } }
    FlatCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column {
                Text("Attendance", style = MaterialTheme.typography.titleMedium, color = c.text)
                Text("Last 14 days", style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
            }
            insight.overallPercentage?.let { Text(percent(it), style = MaterialTheme.typography.titleLarge, color = c.text) }
        }
        if (points.size > 1) {
            val low = (((points.minOf { it.second } - 8).coerceAtLeast(0.0)) / 5).toInt() * 5.0
            Spacer12()
            Row {
                Column(Modifier.height(140.dp).padding(end = 8.dp), verticalArrangement = Arrangement.SpaceBetween) {
                    listOf(100.0, (100.0 + low) / 2, low).forEach { Text("${it.roundToInt()}%", style = MaterialTheme.typography.labelSmall, color = c.textTertiary) }
                }
                Canvas(
                    Modifier.weight(1f).height(140.dp).semantics { contentDescription = "Attendance over the last 14 days" },
                ) {
                    val w = size.width
                    val h = size.height
                    fun x(i: Int) = w * i / (points.size - 1).coerceAtLeast(1)
                    fun y(v: Double) = (h * (1 - ((v - low) / (100 - low)).coerceIn(0.0, 1.0))).toFloat()
                    for (g in 0..2) drawLine(c.separator.copy(alpha = 0.6f), Offset(0f, h * g / 2), Offset(w, h * g / 2), strokeWidth = 1.dp.toPx())
                    val line = Path().apply { points.forEachIndexed { i, p -> if (i == 0) moveTo(x(i), y(p.second)) else lineTo(x(i), y(p.second)) } }
                    val area = Path().apply { addPath(line); lineTo(x(points.size - 1), h); lineTo(0f, h); close() }
                    drawPath(area, Brush.verticalGradient(listOf(c.accent.copy(alpha = 0.20f), c.accent.copy(alpha = 0.01f)), startY = 0f, endY = h))
                    drawPath(line, c.accent, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                    drawCircle(c.accent, radius = 4.dp.toPx(), center = Offset(x(points.size - 1), y(points.last().second)))
                }
            }
            Row(Modifier.fillMaxWidth().padding(start = 36.dp, top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(StaffDates.shortDate(points.first().first), style = MaterialTheme.typography.labelSmall, color = c.textTertiary)
                Text(StaffDates.shortDate(points.last().first), style = MaterialTheme.typography.labelSmall, color = c.textTertiary)
            }
        } else {
            Text("Not enough marked days yet.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(top = 12.dp))
        }
    }
}

@Composable
private fun Spacer12() = Box(Modifier.height(12.dp))

/** Fees collected against billed, as a ring, with what is still owed. */
@Composable
private fun FeesRingCard(f: FeesSummary) {
    val c = Krevo.colors
    val fraction = ((f.collectionPercentage ?: 0.0) / 100).coerceIn(0.0, 1.0).toFloat()
    FlatCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Box(Modifier.size(112.dp).semantics { contentDescription = "${((f.collectionPercentage ?: 0.0)).roundToInt()} percent of fees collected" }, contentAlignment = Alignment.Center) {
                Canvas(Modifier.size(112.dp)) {
                    val stroke = 12.dp.toPx()
                    val inset = stroke / 2
                    val arcSize = Size(size.width - stroke, size.height - stroke)
                    drawArc(c.fill, 0f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
                    drawArc(c.accent, -90f, 360f * fraction, false, Offset(inset, inset), arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("${((f.collectionPercentage ?: 0.0)).roundToInt()}%", style = MaterialTheme.typography.titleLarge, color = c.text)
                    Text("collected", style = MaterialTheme.typography.labelSmall, color = c.textSecondary)
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Column {
                    Text("Fees", style = MaterialTheme.typography.titleMedium, color = c.text)
                    Text(f.year ?: "This year", style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
                }
                Figure("Collected", rupees(f.collectedPaise), c.text)
                Figure("Dues", rupees(f.duesPaise), c.text)
                Figure("Overdue", rupees(f.overduePaise), if (f.overduePaise > 0) c.danger else c.text)
            }
        }
    }
}

@Composable
private fun Figure(label: String, value: String, color: Color) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary)
        Text(value, style = MaterialTheme.typography.titleSmall, color = color)
    }
}

