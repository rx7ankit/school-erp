package tech.krevo.app.features.staff

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
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
import tech.krevo.app.data.staff.DayOverview
import tech.krevo.app.data.staff.StaffDashboard
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.StaffRepository
import tech.krevo.app.data.staff.noSchoolReason
import tech.krevo.app.design.GlassCard
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.Radius

/** What both Academic pieces on Home (the school attendance card and the numbers under it) read, loaded once. */
internal data class AcademicSnapshot(val dashboard: StaffDashboard, val insight: AttendanceInsight?, val overview: DayOverview?)

internal suspend fun StaffRepository.academicSnapshot(): AcademicSnapshot = coroutineScope {
    val d = async { dashboard() }
    val insight = async { runCatching { attendanceInsight(14) }.getOrNull() }
    val overview = async { runCatching { dayOverview(StaffDates.today()) }.getOrNull() }
    AcademicSnapshot(d.await(), insight.await(), overview.await())
}

/**
 * The school's attendance today, on a glass card. One tap opens the Academic tab. Marking is
 * done per class, from My attendance or the class page, so there is no big button here.
 */
@Composable
internal fun AcademicHeroBlock(loader: Loader<AcademicSnapshot>, go: (StaffTab) -> Unit) {
    Loaded(loader, skeleton = { BlockSkeleton(170.dp) }) { (d, _, overview) ->
        val off = noSchoolReason(overview?.holiday, StaffDates.isSunday(StaffDates.today()))
        val marked = if (d.classesTotal == 0) 0f else d.classesMarkedToday.toFloat() / d.classesTotal
        GlassCard(radius = 32.dp, onClick = { go(StaffTab.ACADEMIC) }) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("SCHOOL ATTENDANCE TODAY", style = MaterialTheme.typography.labelMedium, color = Krevo.colors.accent, modifier = Modifier.weight(1f))
                Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Krevo.colors.textTertiary)
            }
            if (off != null && d.classesMarkedToday == 0) {
                CardTitle("No school today", MaterialTheme.typography.headlineLarge)
                CardNote(off)
            } else {
                CardTitle(
                    d.todayPercentage?.let { String.format(java.util.Locale.ENGLISH, "%.0f%%", it) } ?: "Not marked yet",
                    if (d.todayPercentage == null) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.headlineLarge,
                )
                CardNote("${d.classesMarkedToday} of ${d.classesTotal} classes marked")
                ThinProgress(marked)
            }
        }
    }
}

/** Students, this month's attendance, staff in, and the 14-day line. */
@Composable
internal fun AcademicStatsBlock(loader: Loader<AcademicSnapshot>) {
    val snapshot = loader.state.value ?: return
    val d = snapshot.dashboard
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            GlanceCard("Students", d.students.toString(), "${d.classes} ${if (d.classes == 1) "class" else "classes"}")
            GlanceCard("This month", percent(d.monthPercentage), "attendance")
            d.staff?.let { GlanceCard("Staff in", "${it.presentToday}/${it.activeStaff}", if (it.notMarkedToday > 0) "${it.notMarkedToday} not marked" else "all marked") }
        }
        snapshot.insight?.let { TrendCard(it) }
    }
}

/** A title on an attendance card. */
@Composable
internal fun CardTitle(text: String, style: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.headlineMedium) {
    Text(text, style = style, color = Krevo.colors.text)
}

/** The quieter line under it. */
@Composable
internal fun CardNote(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary)
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
