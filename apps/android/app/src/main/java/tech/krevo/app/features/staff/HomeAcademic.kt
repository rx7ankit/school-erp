package tech.krevo.app.features.staff

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
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

/** What the Academic bento on Home reads, loaded once: the dashboard and the 14-day insight. */
internal data class AcademicSnapshot(val dashboard: StaffDashboard, val insight: AttendanceInsight?)

internal suspend fun StaffRepository.academicSnapshot(): AcademicSnapshot = coroutineScope {
    val d = async { dashboard() }
    val insight = async { runCatching { attendanceInsight(14) }.getOrNull() }
    AcademicSnapshot(d.await(), insight.await())
}

/**
 * The Academic bento: one outlined container, three small number tiles above and one wide attendance tile below
 * (heading, overall percentage, 14-day line). Tapping the attendance tile opens the Academic tab.
 */
@Composable
internal fun AcademicBentoBlock(loader: Loader<AcademicSnapshot>, go: (StaffTab) -> Unit) {
    val c = Krevo.colors
    val shape = RoundedCornerShape(30.dp)
    Column(
        Modifier.fillMaxWidth()
            .background(c.bg.copy(alpha = 0.72f), shape)
            .border(1.dp, c.separator, shape)
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Loaded(loader, skeleton = { BlockSkeleton(220.dp) }) { snapshot ->
            val d = snapshot.dashboard
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Max), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                BentoStat("Students", d.students.toString(), "${d.classes} ${if (d.classes == 1) "class" else "classes"}", Modifier.weight(1f))
                BentoStat("This month", percent(d.monthPercentage), "attendance", Modifier.weight(1f))
                d.staff?.let {
                    BentoStat("Staff in", "${it.presentToday}/${it.activeStaff}", if (it.notMarkedToday > 0) "${it.notMarkedToday} not marked" else "all marked", Modifier.weight(1f))
                }
            }
            AttendanceTile(snapshot.insight) { go(StaffTab.ACADEMIC) }
        }
    }
}

@Composable
private fun BentoStat(label: String, value: String, hint: String, modifier: Modifier) {
    val c = Krevo.colors
    Column(modifier.fillMaxHeight().background(c.card, RoundedCornerShape(22.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = c.textSecondary, maxLines = 1)
        Text(value, style = MaterialTheme.typography.titleLarge, color = c.text, maxLines = 1)
        Text(hint, style = MaterialTheme.typography.bodySmall, color = c.textTertiary, maxLines = 1)
    }
}

/** The last two weeks of attendance as one thin line, on a wide tile. */
@Composable
private fun AttendanceTile(insight: AttendanceInsight?, onClick: () -> Unit) {
    val c = Krevo.colors
    val shape = RoundedCornerShape(22.dp)
    val points = insight?.trend?.mapNotNull { it.percentage } ?: emptyList()
    Column(
        Modifier.fillMaxWidth().clip(shape).background(c.card, shape).clickable(onClick = onClick).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Attendance, 14 days", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = c.text)
            insight?.overallPercentage?.let {
                Text(String.format(java.util.Locale.ENGLISH, "%.1f%%", it), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = c.text)
            }
        }
        if (points.size > 1) {
            val low = (points.min() - 6).coerceAtLeast(0.0)
            Canvas(Modifier.fillMaxWidth().height(64.dp).semantics { contentDescription = "Attendance over the last 14 days" }) {
                fun x(i: Int) = size.width * i / (points.size - 1)
                fun y(v: Double) = (size.height * (1 - ((v - low) / (100 - low)).coerceIn(0.0, 1.0))).toFloat()
                val line = Path().apply { points.forEachIndexed { i, v -> if (i == 0) moveTo(x(i), y(v)) else lineTo(x(i), y(v)) } }
                drawPath(line, c.accent, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
            }
        } else {
            Text("Not enough marked days yet.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
        }
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
