package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import tech.krevo.app.data.staff.ClassDay
import tech.krevo.app.data.staff.ClassTeam
import tech.krevo.app.data.staff.StaffClass
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.classTeam
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.PillButton
import java.util.Locale

private fun pct(v: Double?) = v?.let { String.format(Locale.ENGLISH, "%.0f%%", it) } ?: "–"

/** "Today", or the date for any other day. */
private fun dayLabel(day: String) = if (day == StaffDates.today()) "Today" else StaffDates.date(day)

/**
 * Every class this person can see, two to a row, with the day's attendance on each. A date control looks at any past
 * day. Tap a class for its page; marking attendance is a button there.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun StaffClassesScreen(onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    var day by rememberSaveable { mutableStateOf(StaffDates.today()) }
    var picking by remember { mutableStateOf(false) }
    val loader = rememberLoader(day, staff.refresh) { staff.repo.dayOverview(day) }

    PushedPage("Classes", onBack) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(dayLabel(day).uppercase(), style = MaterialTheme.typography.labelMedium, color = c.textSecondary)
                val o = loader.state.value
                Text(if (o == null) "–" else pct(o.percentage), style = MaterialTheme.typography.headlineLarge, color = c.text)
                Text(
                    if (o == null) "" else "${o.classesMarked} of ${o.classesTotal} classes marked",
                    style = MaterialTheme.typography.bodyMedium, color = c.textSecondary,
                )
            }
            TapSurface(onClick = { picking = true }, color = c.card, shape = CircleShape) {
                Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Filled.DateRange, contentDescription = "Pick a date", tint = c.text, modifier = Modifier.size(18.dp))
                    Text(StaffDates.shortDate(day), style = MaterialTheme.typography.labelLarge, color = c.text)
                }
            }
        }
        Loaded(loader) { o ->
            o.holiday?.let { Text("$it. Attendance is not taken on this day.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary) }
            if (o.classes.isEmpty()) EmptyNote("No classes yet.")
            o.classes.chunked(2).forEach { pair ->
                Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    pair.forEach { d -> ClassCard(d, staff.classFor(d.classId, d.classLabel), Modifier.weight(1f)) { staff.push(StaffDest.ClassPage(it, day)) } }
                    if (pair.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }

    if (picking) {
        val today = StaffDates.toPickerMillis(StaffDates.today())
        val state = rememberDatePickerState(
            initialSelectedDateMillis = StaffDates.toPickerMillis(day),
            selectableDates = object : SelectableDates { override fun isSelectableDate(utcTimeMillis: Long) = utcTimeMillis <= today },
        )
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = { TextButton(onClick = { state.selectedDateMillis?.let { day = StaffDates.fromPickerMillis(it) }; picking = false }) { Text("OK") } },
            dismissButton = { TextButton(onClick = { picking = false }) { Text("Cancel") } },
        ) { DatePicker(state) }
    }
}

@Composable
private fun ClassCard(d: ClassDay, cls: StaffClass, modifier: Modifier, onOpen: (StaffClass) -> Unit) {
    val c = Krevo.colors
    TapSurface(onClick = { onOpen(cls) }, modifier = modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(16.dp).height(104.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Class ${d.classLabel}", style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1)
            Text("${cls.students} students", style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
            Spacer(Modifier.weight(1f))
            if (d.marked && d.percentage != null) {
                Text(pct(d.percentage), style = MaterialTheme.typography.titleLarge, color = c.text)
                ThinProgress((d.percentage / 100).toFloat())
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.size(7.dp).background(c.accent, CircleShape))
                    Text("Not marked", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                }
            }
        }
    }
}

/** One class: its numbers, the button to take attendance, and who teaches it. */
@Composable
internal fun StaffClassScreen(cls: StaffClass, day: String, onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val today = rememberLoader(cls.id, day) { staff.repo.dayOverview(day) }
    val team = rememberLoader(cls.id) {
        coroutineScope {
            val rows = async { staff.repo.assignments(cls.id) }
            val subjects = async { staff.repo.subjects() }
            classTeam(rows.await(), subjects.await(), cls.subjectIds)
        }
    }
    val percent = today.state.value?.classes?.firstOrNull { it.classId == cls.id }?.takeIf { it.marked }?.percentage

    PushedPage("Class ${cls.label}", onBack) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard("Students", cls.students.toString(), Modifier.weight(1f))
            StatCard(dayLabel(day), if (today.state.value == null) "–" else if (percent != null) pct(percent) else "Not marked", Modifier.weight(1f))
        }
        PillButton(text = "Attendance", onClick = { staff.push(StaffDest.AttendanceSheet(cls, day)) }, kind = ButtonKind.BRAND, modifier = Modifier.fillMaxWidth())
        Loaded(team) { t -> TeamSection(t) }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier) {
    FlatCard(modifier) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary)
        Text(value, style = MaterialTheme.typography.titleLarge, color = Krevo.colors.text, maxLines = 1)
    }
}

@Composable
private fun TeamSection(t: ClassTeam) {
    val c = Krevo.colors
    Column {
        SmallLabel("Class teacher")
        PlainRow(title = t.classTeacher ?: "Not assigned", divider = false)
        Spacer(Modifier.height(8.dp))
        SmallLabel("Subjects")
        if (t.subjects.isEmpty()) Text("No subjects set up yet.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(top = 8.dp))
        t.subjects.forEachIndexed { i, (subject, teacher) ->
            PlainRow(title = subject, divider = i < t.subjects.lastIndex, accessory = {
                Text(teacher ?: "No teacher", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
            })
        }
    }
}
