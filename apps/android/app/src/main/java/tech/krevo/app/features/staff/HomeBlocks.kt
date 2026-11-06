package tech.krevo.app.features.staff

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import tech.krevo.app.data.staff.AttendanceInsight
import tech.krevo.app.data.staff.DayEntry
import tech.krevo.app.data.staff.PeriodStatus
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.noSchoolReason
import tech.krevo.app.data.staff.periodStatuses
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.Radius

// The cards on the staff Home. Each loads its own small request, so a slow block never holds up the others.

/** A grey placeholder the size of a block, while it loads. */
@Composable
internal fun BlockSkeleton(height: Dp) {
    Box(Modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(Radius.card)).background(Krevo.colors.card))
}

/** A grey card that opens something: a title with a chevron, then [content]. */
@Composable
private fun NavCard(title: String, onClick: () -> Unit, content: @Composable () -> Unit) {
    TapCard(onClick = onClick) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = Krevo.colors.text, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Krevo.colors.textTertiary)
        }
        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier = Modifier, tone: Color = Krevo.colors.text) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary)
        Text(value, style = MaterialTheme.typography.titleLarge, color = tone, maxLines = 1)
    }
}

// ---- My day

/** Today's periods as cards to swipe through, each with a chip: Now, Next, Done or Cover. */
@Composable
internal fun MyDayBlock(hideIfEmpty: Boolean) {
    val staff = LocalStaff.current
    val loader = rememberReloading(staff.refresh) { staff.repo.myDay(StaffDates.today()) }
    if (hideIfEmpty && loader.state.value?.isEmpty() == true) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BlockTitle("Today's classes", "Timetable") { staff.push(StaffDest.Timetable) }
        Loaded(loader, skeleton = { BlockSkeleton(132.dp) }) { entries ->
            if (entries.isEmpty()) {
                Text("No classes scheduled today.", style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary)
            } else {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    periodStatuses(entries, StaffDates.nowHm()).forEach { (e, status) -> PeriodCard(e, status) }
                }
            }
        }
    }
}

@Composable
private fun PeriodCard(e: DayEntry, status: PeriodStatus) {
    val c = Krevo.colors
    Surface(
        modifier = Modifier.width(210.dp), shape = RoundedCornerShape(Radius.card), color = c.card, tonalElevation = 0.dp, shadowElevation = 0.dp,
        border = if (status == PeriodStatus.NOW) BorderStroke(1.5.dp, c.accent) else null,
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Pill(StaffDates.clock(e.startsAt))
                when (status) {
                    PeriodStatus.COVER -> ToneChip("Cover", c.warning)
                    PeriodStatus.NOW -> ToneChip("Now", c.success)
                    PeriodStatus.NEXT -> ToneChip("Next", c.warning)
                    PeriodStatus.DONE -> Pill("Done")
                    PeriodStatus.LATER -> Unit
                }
            }
            Text(e.subjectName, style = MaterialTheme.typography.titleLarge, color = if (status == PeriodStatus.DONE) c.textSecondary else c.text, maxLines = 1)
            HorizontalDivider(color = c.separator)
            Text("Class ${e.classLabel}", style = MaterialTheme.typography.titleSmall, color = c.text)
            Text(e.periodName, style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
        }
    }
}

// ---- Notices

/** The latest three announcements, for everyone. */
@Composable
internal fun NoticesBlock() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberReloading(staff.refresh) { staff.repo.broadcasts() }
    Column {
        BlockTitle("Notices", "View all") { staff.push(StaffDest.Announcements) }
        Loaded(loader, skeleton = { BlockSkeleton(96.dp) }) { rows ->
            if (rows.isEmpty()) Text("Nothing sent yet.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(vertical = 8.dp))
            val latest = rows.take(3)
            Column {
                latest.forEachIndexed { i, b ->
                    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(b.title, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1)
                        Text(b.body, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, maxLines = 2)
                        Text("${b.senderName} · ${StaffDates.instant(b.createdAt)}", style = MaterialTheme.typography.bodySmall, color = c.textTertiary)
                    }
                    if (i < latest.lastIndex) HorizontalDivider(color = c.separator)
                }
            }
        }
    }
}

// ---- Academic

/** The school's attendance today and the numbers behind it. Only for people with the Academic permission. */
@Composable
internal fun AcademicBlock(go: (StaffTab) -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberReloading(staff.refresh) {
        coroutineScope {
            val d = async { staff.repo.dashboard() }
            val insight = async { runCatching { staff.repo.attendanceInsight(14) }.getOrNull() }
            val overview = async { runCatching { staff.repo.dayOverview(StaffDates.today()) }.getOrNull() }
            Triple(d.await(), insight.await(), overview.await())
        }
    }
    Loaded(loader, skeleton = { BlockSkeleton(250.dp) }) { (d, insight, overview) ->
        val off = noSchoolReason(overview?.holiday, StaffDates.isSunday(StaffDates.today()))
        val unmarked = (d.classesTotal - d.classesMarkedToday).coerceAtLeast(0)
        val closed = off != null && d.classesMarkedToday == 0
        FlatCard {
            Text("ATTENDANCE TODAY", style = MaterialTheme.typography.labelMedium, color = c.accent)
            if (closed) {
                Text("No school today", style = MaterialTheme.typography.headlineMedium, color = c.text, modifier = Modifier.padding(top = 8.dp))
                Text(off.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
            } else {
                Text(
                    if (unmarked == 0) "All marked" else "$unmarked ${if (unmarked == 1) "class" else "classes"} to mark",
                    style = MaterialTheme.typography.headlineMedium, color = c.text, modifier = Modifier.padding(top = 8.dp),
                )
                Text(
                    (d.todayPercentage?.let { String.format(java.util.Locale.ENGLISH, "%.0f%% present · ", it) } ?: "") + "${d.classesMarkedToday} of ${d.classesTotal} marked",
                    style = MaterialTheme.typography.bodyMedium, color = c.textSecondary,
                )
                ThinProgress(if (d.classesTotal == 0) 0f else d.classesMarkedToday.toFloat() / d.classesTotal, Modifier.padding(top = 12.dp))
            }
            TapSurface(onClick = { go(StaffTab.ACADEMIC) }, color = c.accent, shape = androidx.compose.foundation.shape.CircleShape, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
                Text(
                    if (unmarked > 0 && !closed) "Open classes" else "View classes", style = MaterialTheme.typography.titleMedium, color = c.onAccent,
                    modifier = Modifier.padding(vertical = 14.dp).fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            GlanceCard("Students", d.students.toString(), "${d.classes} ${if (d.classes == 1) "class" else "classes"}")
            GlanceCard("This month", percent(d.monthPercentage), "attendance")
            d.staff?.let { GlanceCard("Staff in", "${it.presentToday}/${it.activeStaff}", if (it.notMarkedToday > 0) "${it.notMarkedToday} not marked" else "all marked") }
        }
        insight?.let { TrendCard(it) }
    }
}

@Composable
private fun GlanceCard(label: String, value: String, hint: String) {
    Surface(shape = RoundedCornerShape(Radius.card), color = Krevo.colors.card, tonalElevation = 0.dp, shadowElevation = 0.dp) {
        Column(Modifier.width(132.dp).padding(16.dp)) {
            Text(label, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary)
            Text(value, style = MaterialTheme.typography.titleLarge, color = Krevo.colors.text, maxLines = 1)
            Text(hint, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textTertiary, maxLines = 1)
        }
    }
}

/** The last two weeks of attendance as one thin line. */
@Composable
private fun TrendCard(insight: AttendanceInsight) {
    val c = Krevo.colors
    val points = insight.trend.mapNotNull { it.percentage }
    if (points.size < 2) return
    FlatCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Attendance, 14 days", style = MaterialTheme.typography.titleSmall, color = c.text)
            insight.overallPercentage?.let { Text(percent(it), style = MaterialTheme.typography.titleSmall, color = c.text) }
        }
        val low = (points.min() - 6).coerceAtLeast(0.0)
        Canvas(Modifier.fillMaxWidth().padding(top = 12.dp).height(56.dp).semantics { contentDescription = "Attendance over the last 14 days" }) {
            fun x(i: Int) = size.width * i / (points.size - 1)
            fun y(v: Double) = (size.height * (1 - ((v - low) / (100 - low)).coerceIn(0.0, 1.0))).toFloat()
            val line = Path().apply { points.forEachIndexed { i, v -> if (i == 0) moveTo(x(i), y(v)) else lineTo(x(i), y(v)) } }
            drawPath(line, c.accent, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
            drawCircle(c.accent, radius = 4.dp.toPx(), center = Offset(x(points.lastIndex), y(points.last())))
        }
    }
}

// ---- Fees

/** Fee collection in one card. Only for people with the Fees permission. */
@Composable
internal fun FeesBlock(go: (StaffTab) -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberReloading(staff.refresh) { staff.repo.feesSummary() }
    Loaded(loader, skeleton = { BlockSkeleton(150.dp) }) { f ->
        if (f.billedPaise > 0) NavCard("Fees", onClick = { go(StaffTab.FEES) }) {
            Text(rupees(f.collectedPaise), style = MaterialTheme.typography.headlineMedium, color = c.text)
            ThinProgress(((f.collectionPercentage ?: 0.0) / 100).coerceIn(0.0, 1.0).toFloat())
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("of ${rupees(f.billedPaise)} billed", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                if (f.overduePaise > 0) Text("${rupees(f.overduePaise)} overdue", style = MaterialTheme.typography.titleSmall, color = c.danger)
            }
        }
    }
}

// ---- Library

/** Books out and overdue, in one card. Only for people with the Library permission. */
@Composable
internal fun LibraryBlock(go: (StaffTab) -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberReloading(staff.refresh) { staff.repo.librarySummary() }
    Loaded(loader, skeleton = { BlockSkeleton(120.dp) }) { s ->
        NavCard("Library", onClick = { go(StaffTab.LIBRARY) }) {
            Row(Modifier.fillMaxWidth()) {
                Stat("Books", s.books.toString(), Modifier.weight(1f))
                Stat("On loan", s.onLoan.toString(), Modifier.weight(1f))
                Stat("Overdue", s.overdue.toString(), Modifier.weight(1f), tone = if (s.overdue > 0) c.danger else c.text)
            }
        }
    }
}

// ---- People

/** Who is on staff and how many logins are still to be sent. Opens People & access, a page of its own. */
@Composable
internal fun PeopleBlock() {
    val staff = LocalStaff.current
    val loader = rememberReloading(staff.refresh) { staff.repo.staff("") }
    Loaded(loader, skeleton = { BlockSkeleton(96.dp) }) { list ->
        NavCard("People & access", onClick = { staff.push(StaffDest.People) }) {
            val waiting = list.count { it.notSignedIn }
            Text(
                "${list.size} staff" + if (waiting > 0) " · $waiting not signed in yet" else "",
                style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary,
            )
        }
    }
}
