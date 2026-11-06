package tech.krevo.app.features.staff

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.krevo.app.data.staff.AttendanceCard
import tech.krevo.app.data.staff.StaffClass
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.attendanceCard
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.PillButton

/**
 * The classes this person teaches, always shown: first the "My attendance" card for a class teacher, then one row per
 * class (tap for its page), "My students", and the leave requests waiting for a decision.
 */
@Composable
internal fun MyClassesBlock() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val mine = mineClasses(staff)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BlockTitle("My classes")
        MyAttendanceCard()
        Column {
            if (mine.isEmpty()) {
                Text(
                    if (staff.classes.isEmpty()) "Loading your classes…" else "No classes assigned to you yet.",
                    style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(vertical = 12.dp),
                )
            }
            mine.forEach { (cls, role) ->
                PlainRow(
                    title = "Class ${cls.label}", subtitle = "$role · ${cls.students} students",
                    onClick = { staff.push(StaffDest.ClassPage(cls, StaffDates.today())) },
                    leading = { Text(cls.label, style = MaterialTheme.typography.titleLarge, color = c.text, modifier = Modifier.width(56.dp), maxLines = 1) },
                )
            }
            val leaves = staff.pendingLeaves
            val showLeave = staff.me.canDecideLeave && leaves > 0
            PlainRow(
                title = "My students", subtitle = "Everyone in your classes", onClick = { staff.push(StaffDest.Students) }, divider = showLeave,
                leading = { Icon(Icons.Filled.Person, contentDescription = null, tint = c.text, modifier = Modifier.width(56.dp)) },
            )
            if (showLeave) {
                PlainRow(
                    title = "$leaves leave ${if (leaves == 1) "request" else "requests"} to decide", subtitle = "Parents are waiting for a reply",
                    onClick = { staff.push(StaffDest.Leave) }, divider = false,
                    leading = { Icon(Icons.Filled.DateRange, contentDescription = null, tint = c.accent, modifier = Modifier.width(56.dp)) },
                )
            }
        }
    }
}

/** The classes this person teaches with their role in each, in class order. */
private fun mineClasses(staff: StaffState): List<Pair<StaffClass, String>> =
    staff.me.assignments
        .mapNotNull { a -> staff.classes.firstOrNull { it.id == a.classId }?.let { it to if (a.role == "class_teacher") "Class teacher" else "Subject teacher" } }
        .distinct()
        .sortedWith(compareBy({ staff.classes.indexOf(it.first) }, { it.second }))

/**
 * How many of my classes (as class teacher) still need today's attendance, with a button to mark each. It says "All marked"
 * when done, "No school today" on a Sunday or holiday, and is left out when I am not a class teacher of any class.
 */
@Composable
private fun MyAttendanceCard() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val myIds = staff.me.classTeacherClassIds
    if (myIds.isEmpty()) return
    val loader = rememberReloading(staff.refresh) { staff.repo.dayOverview(StaffDates.today()) }
    Loaded(loader, skeleton = { BlockSkeleton(96.dp) }) { overview ->
        val card = attendanceCard(myIds, overview, StaffDates.isSunday(StaffDates.today()))
        if (card == AttendanceCard.NothingToMark) return@Loaded
        FlatCard {
            Text("MY ATTENDANCE", style = MaterialTheme.typography.labelMedium, color = c.accent)
            when (card) {
                is AttendanceCard.NoSchool -> {
                    Text("No school today", style = MaterialTheme.typography.titleLarge, color = c.text, modifier = Modifier.padding(top = 4.dp))
                    Text(card.reason, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                }
                AttendanceCard.AllMarked ->
                    Text("All marked", style = MaterialTheme.typography.titleLarge, color = c.text, modifier = Modifier.padding(top = 4.dp))
                is AttendanceCard.ToMark -> {
                    val n = card.classes.size
                    Text(
                        "$n ${if (n == 1) "class needs" else "classes need"} attendance today",
                        style = MaterialTheme.typography.titleLarge, color = c.text, modifier = Modifier.padding(top = 4.dp),
                    )
                    Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        card.classes.forEach { day ->
                            PillButton(
                                text = "Mark Class ${day.classLabel}", kind = ButtonKind.BRAND, modifier = Modifier.fillMaxWidth(),
                                onClick = { staff.push(StaffDest.AttendanceSheet(staff.classFor(day.classId, day.classLabel), StaffDates.today())) },
                            )
                        }
                    }
                }
                AttendanceCard.NothingToMark -> Unit
            }
        }
    }
}
