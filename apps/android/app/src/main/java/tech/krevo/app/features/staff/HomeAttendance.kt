package tech.krevo.app.features.staff

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import tech.krevo.app.data.staff.ClassDay
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.noSchoolReason
import tech.krevo.app.design.GlassCard
import tech.krevo.app.design.Krevo

/**
 * Attendance for the classes I am class teacher of, as one compact glass row under the header, and only for a class
 * teacher. One class: an orange caption ("CLASS 1-A · TODAY") over its state ("Not marked" or "93% present") with a small
 * black Mark / View button on the right. Several: "Attendance today", "n of m marked" and a pill per class. A Sunday or
 * holiday with nothing marked says "No school today".
 */
@Composable
internal fun MyAttendanceCard() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val myIds = staff.me.classTeacherClassIds
    if (myIds.isEmpty()) return
    val today = StaffDates.today()
    val loader = rememberReloading(staff.refresh) { staff.repo.dayOverview(today) }
    val overview = loader.state.value
    if (loader.state is Ld.Failed) return

    // My classes, in the order the overview lists them (it carries each one's label).
    val days: List<ClassDay> = overview?.classes?.filter { it.classId in myIds } ?: emptyList()
    if (overview != null && days.isEmpty()) return
    val markedCount = days.count { it.marked }
    val off = overview?.let { noSchoolReason(it.holiday, StaffDates.isSunday(today)) }
    val single = days.size == 1
    val caption = if (single) "CLASS ${days[0].classLabel} · TODAY".uppercase() else "ATTENDANCE TODAY"

    GlassCard(radius = 22.dp, contentPadding = PaddingValues(start = 16.dp, end = 9.dp, top = 8.dp, bottom = 8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(caption, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = c.accent, maxLines = 1)
                val headline = when {
                    overview == null -> ""
                    off != null && markedCount == 0 -> "No school today"
                    single -> if (days[0].marked) days[0].percentage?.let { "${Math.round(it)}% present" } ?: "Marked" else "Not marked"
                    else -> "$markedCount of ${days.size} marked"
                }
                if (overview == null) Box(Modifier.padding(vertical = 4.dp).width(120.dp).height(18.dp).background(c.fill, CircleShape))
                else Text(headline, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (overview != null && !(off != null && markedCount == 0)) {
                if (single) {
                    val day = days[0]
                    ActionPill(if (day.marked) "View" else "Mark") { staff.push(StaffDest.AttendanceSheet(staff.classFor(day.classId, day.classLabel), today)) }
                }
            }
        }
        if (overview != null && !single && !(off != null && markedCount == 0)) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                days.forEach { day ->
                    val done = day.marked
                    Box(
                        Modifier.height(34.dp).clip(CircleShape)
                            .background(if (done) c.text.copy(alpha = 0.08f) else c.accent)
                            .clickable { staff.push(StaffDest.AttendanceSheet(staff.classFor(day.classId, day.classLabel), today)) }
                            .padding(horizontal = 14.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            if (done) "${day.classLabel} ✓" else "${day.classLabel} · Mark",
                            style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold,
                            color = if (done) c.text else c.onAccent, maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}

/** A small black pill, 38dp high, with white text and an up-right arrow. */
@Composable
private fun ActionPill(text: String, onClick: () -> Unit) {
    val c = Krevo.colors
    Row(
        Modifier.padding(start = 12.dp).height(38.dp).clip(CircleShape).background(c.solid).clickable(onClick = onClick).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, color = c.onSolid, maxLines = 1)
        Icon(StaffIcons.ArrowUpRight, contentDescription = null, tint = c.onSolid, modifier = Modifier.size(13.dp))
    }
}
