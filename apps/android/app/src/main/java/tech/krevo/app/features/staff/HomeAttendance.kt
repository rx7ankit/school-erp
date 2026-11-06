package tech.krevo.app.features.staff

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.krevo.app.data.staff.AttendanceCard
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.attendanceCard
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.DotCard
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.PillButton

/**
 * Attendance for the classes I am class teacher of, on a grey card with the orange dot corner: how many still need
 * marking today, and a button for each. It says so on a Sunday or a holiday, and is left out when I am not a class teacher.
 */
@Composable
internal fun MyAttendanceCard() {
    val staff = LocalStaff.current
    val myIds = staff.me.classTeacherClassIds
    if (myIds.isEmpty()) return
    val loader = rememberReloading(staff.refresh) { staff.repo.dayOverview(StaffDates.today()) }
    val overview = loader.state.value
    val card = overview?.let { attendanceCard(myIds, it, StaffDates.isSunday(StaffDates.today())) }
    if (card == AttendanceCard.NothingToMark || loader.state is Ld.Failed) return

    DotCard {
        Text("MY ATTENDANCE TODAY", style = MaterialTheme.typography.labelMedium, color = Krevo.colors.accent)
        when (card) {
            null -> Box(Modifier.width(160.dp).height(28.dp).background(Krevo.colors.fill, CircleShape))
            is AttendanceCard.NoSchool -> {
                CardTitle("No school today")
                CardNote(card.reason)
            }
            AttendanceCard.AllMarked -> {
                CardTitle("All marked")
                CardNote("${myIds.size} ${if (myIds.size == 1) "class" else "classes"} done")
            }
            is AttendanceCard.ToMark -> {
                CardTitle("${card.classes.size} to mark")
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    card.classes.forEach { day ->
                        PillButton(
                            text = if (myIds.size == 1) "Mark attendance" else "Mark Class ${day.classLabel}", kind = ButtonKind.BRAND,
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { staff.push(StaffDest.AttendanceSheet(staff.classFor(day.classId, day.classLabel), StaffDates.today())) },
                        )
                    }
                }
            }
            AttendanceCard.NothingToMark -> Unit
        }
    }
}
