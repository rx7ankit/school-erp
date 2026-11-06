package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.AttendanceSheet
import tech.krevo.app.data.staff.Mark
import tech.krevo.app.data.staff.SheetStudent
import tech.krevo.app.data.staff.StaffClass
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.PillButton

/** One class on one day. Tap P / A / L per student, then Save. */
@Composable
internal fun AttendanceSheetScreen(cls: StaffClass, initialDay: String, onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    var day by rememberSaveable { mutableStateOf(initialDay) }
    val loader = rememberLoader(cls.id, day) { staff.repo.attendanceSheet(cls.id, day) }
    val students = remember(cls.id, day) { mutableStateListOf<SheetStudent>() }
    var original by remember(cls.id, day) { mutableStateOf<List<SheetStudent>>(emptyList()) }
    var canMark by remember(cls.id, day) { mutableStateOf(true) }
    var holiday by remember(cls.id, day) { mutableStateOf<String?>(null) }
    var saved by remember(cls.id, day) { mutableStateOf(false) }
    var saving by remember(cls.id, day) { mutableStateOf(false) }
    var message by remember(cls.id, day) { mutableStateOf<String?>(null) }

    fun apply(s: AttendanceSheet) {
        students.clear(); students.addAll(s.students)
        original = s.students; canMark = s.canMark; holiday = s.holiday; saved = s.marked
    }
    androidx.compose.runtime.LaunchedEffect(loader.state) { (loader.state as? Ld.Ok)?.value?.let { apply(it) } }

    val changed = students.map { it.firstHalf to it.secondHalf } != original.map { it.firstHalf to it.secondHalf }
    val dirty = changed || !saved
    fun count(m: Mark) = students.count { it.firstHalf == m && it.secondHalf == m }
    val editable = canMark && holiday == null

    Column(Modifier.fillMaxSize()) {
        PushedHeader("Class ${cls.label}", onBack)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            LazyColumn(
                Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 120.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    Row(
                        Modifier.fillMaxWidth().clip(CircleShape).background(c.card).padding(horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Icon(Icons.Filled.KeyboardArrowLeft, contentDescription = "Previous day", modifier = Modifier.size(44.dp).clip(CircleShape).clickable { day = StaffDates.addDays(day, -1) }.padding(10.dp))
                        Text(StaffDates.date(day), style = MaterialTheme.typography.titleMedium, color = c.text)
                        val canNext = day < StaffDates.today()
                        Icon(
                            Icons.Filled.KeyboardArrowRight, contentDescription = "Next day", tint = if (canNext) c.text else c.textTertiary,
                            modifier = Modifier.size(44.dp).clip(CircleShape).clickable(enabled = canNext) { day = StaffDates.addDays(day, 1) }.padding(10.dp),
                        )
                    }
                }
                when (val s = loader.state) {
                    Ld.Loading -> item { StaffSkeleton(4) }
                    is Ld.Failed -> item { ErrorNote(s.message) { scope.launch { loader.run() } } }
                    is Ld.Ok -> {
                        item {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                holiday?.let { FlatCard { Text("$it. Attendance is not taken on this day.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary) } }
                                if (holiday == null && !canMark) FlatCard { Text("You can't mark attendance for this class.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary) }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    ToneChip("Present ${count(Mark.PRESENT)}", c.success)
                                    ToneChip("Absent ${count(Mark.ABSENT)}", c.danger)
                                    ToneChip("Leave ${count(Mark.LEAVE)}", c.warning)
                                }
                                if (editable) {
                                    TapSurface(
                                        onClick = {
                                            haptic.select()
                                            for (i in students.indices) students[i] = students[i].copy(firstHalf = Mark.PRESENT, secondHalf = Mark.PRESENT)
                                        },
                                        color = c.bg, shape = CircleShape,
                                    ) { Text("Mark everyone present", style = MaterialTheme.typography.labelLarge, color = c.text, modifier = Modifier.padding(vertical = 8.dp)) }
                                }
                            }
                        }
                        items(students.size, key = { students[it].studentId }) { i ->
                            StudentMarkRow(students[i], editable) { m ->
                                haptic.select()
                                students[i] = students[i].copy(firstHalf = m, secondHalf = m)
                            }
                        }
                    }
                }
            }
            // Always on screen, so the count and Save are never a long scroll away.
            if (loader.state is Ld.Ok && editable) {
                Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(c.bg).padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    message?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = if (saved) c.success else c.danger) }
                    if (saved && !dirty) {
                        Text("Saved", style = MaterialTheme.typography.titleMedium, color = c.success, modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    } else {
                        PillButton(
                            text = "Save attendance", kind = ButtonKind.BRAND, loading = saving, modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                scope.launch {
                                    saving = true; message = null
                                    try {
                                        val result = staff.repo.saveAttendance(cls.id, day, students.toList())
                                        apply(result); saved = true; haptic.success()
                                    } catch (e: kotlinx.coroutines.CancellationException) {
                                        throw e
                                    } catch (e: Exception) {
                                        message = e.message
                                    }
                                    saving = false
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StudentMarkRow(s: SheetStudent, editable: Boolean, onMark: (Mark) -> Unit) {
    val c = Krevo.colors
    FlatCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            NameAvatar(s.name, 38.dp)
            Column(Modifier.weight(1f)) {
                Text(s.name, style = MaterialTheme.typography.titleSmall, color = c.text, maxLines = 1)
                Text(s.rollNo?.let { "Roll $it" } ?: s.scholarNo, style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
            }
            if (s.firstHalf != s.secondHalf) ToneChip("Half", c.warning)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                MarkChip("P", Mark.PRESENT, c.success, s, editable, onMark)
                MarkChip("A", Mark.ABSENT, c.danger, s, editable, onMark)
                MarkChip("L", Mark.LEAVE, c.warning, s, editable, onMark)
            }
        }
    }
}

@Composable
private fun MarkChip(letter: String, value: Mark, tone: androidx.compose.ui.graphics.Color, s: SheetStudent, editable: Boolean, onMark: (Mark) -> Unit) {
    val c = Krevo.colors
    val on = s.firstHalf == value && s.secondHalf == value
    TapSurface(
        onClick = { onMark(value) }, enabled = editable, color = if (on) tone else c.fill, shape = CircleShape,
        modifier = Modifier.size(38.dp).semantics { contentDescription = "${s.name}, ${value.wire}" + if (on) ", selected" else "" },
    ) {
        Box(Modifier.size(38.dp), contentAlignment = Alignment.Center) {
            Text(letter, style = MaterialTheme.typography.labelLarge, color = if (on) androidx.compose.ui.graphics.Color.White else c.textSecondary)
        }
    }
}
