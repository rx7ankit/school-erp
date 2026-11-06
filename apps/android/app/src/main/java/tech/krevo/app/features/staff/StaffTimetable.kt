package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.krevo.app.data.staff.DayEntry
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.Krevo

/** My timetable: the periods I teach, one school day at a time. */
@Composable
internal fun StaffTimetableScreen(onBack: () -> Unit) {
    val staff = LocalStaff.current
    var day by rememberSaveable { mutableStateOf(StaffDates.today()) }
    val loader = rememberLoader(day) { staff.repo.myDay(day) }
    PushedPage("My timetable", onBack) {
        ChipRow(StaffDates.schoolWeek().map { it to (StaffDates.weekdayShort(it) + " " + it.takeLast(2)) }, day) { day = it }
        Loaded(loader) { entries ->
            if (entries.isEmpty()) EmptyNote("No classes this day.")
            entries.forEach { PeriodRow(it) }
        }
    }
}

/** One period of the day: time, subject, class. */
@Composable
private fun PeriodRow(e: DayEntry) {
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
