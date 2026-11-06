package tech.krevo.app.features.staff

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
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
import tech.krevo.app.design.horizontalEdgeFade

/**
 * Attendance for the classes I am class teacher of, on a glass card, and only for a class teacher (anyone else who may
 * mark does it from the Academic tab). One class: its state today with a Mark / View button beside it. Several: "n of m
 * marked" and a pill per class. A Sunday or holiday with nothing marked says "No school today".
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

    GlassCard {
        Text(
            if (days.size == 1) "Class ${days[0].classLabel} · attendance today" else "Attendance today",
            style = MaterialTheme.typography.labelMedium, color = c.accent,
        )
        when {
            overview == null -> Box(Modifier.width(160.dp).height(28.dp).background(c.fill, CircleShape))
            off != null && markedCount == 0 -> {
                CardTitle("No school today", MaterialTheme.typography.titleLarge)
                CardNote(off)
            }
            days.size == 1 -> {
                val day = days[0]
                val cls = staff.classFor(day.classId, day.classLabel)
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        if (day.marked) {
                            CardTitle(day.percentage?.let { "${Math.round(it)}% present" } ?: "Marked", MaterialTheme.typography.titleLarge)
                            CardNote("${if (day.students > 0) day.students else cls.students} students")
                        } else {
                            CardTitle("Not marked", MaterialTheme.typography.titleLarge)
                        }
                    }
                    BlackButton(if (day.marked) "View attendance" else "Mark attendance") {
                        staff.push(StaffDest.AttendanceSheet(cls, today))
                    }
                }
            }
            else -> {
                CardTitle("$markedCount of ${days.size} marked", MaterialTheme.typography.titleLarge)
                val scroll = rememberScrollState()
                Row(
                    Modifier.fillMaxWidth().horizontalEdgeFade(scroll).horizontalScroll(scroll),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    days.forEach { day ->
                        val done = day.marked
                        Box(
                            Modifier.heightIn(min = 40.dp).clip(CircleShape)
                                .background(if (done) c.text.copy(alpha = 0.08f) else c.accent)
                                .clickable { staff.push(StaffDest.AttendanceSheet(staff.classFor(day.classId, day.classLabel), today)) }
                                .padding(horizontal = 16.dp),
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
}

/** A medium black pill with white text and a small up-right arrow. */
@Composable
private fun BlackButton(text: String, onClick: () -> Unit) {
    val c = Krevo.colors
    Row(
        Modifier.padding(start = 12.dp).heightIn(min = 44.dp).clip(CircleShape).background(c.solid).clickable(onClick = onClick).padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, color = c.onSolid, maxLines = 1, overflow = TextOverflow.Clip)
        Icon(StaffIcons.ArrowUpRight, contentDescription = null, tint = c.onSolid, modifier = Modifier.size(14.dp))
    }
}
