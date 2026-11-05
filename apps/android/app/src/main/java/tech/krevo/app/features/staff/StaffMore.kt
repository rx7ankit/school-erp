package tech.krevo.app.features.staff

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoTextField
import tech.krevo.app.design.PillButton
import tech.krevo.app.design.TwoToneTitle

private enum class MoreRoute { TIMETABLE, ANNOUNCEMENTS, FEES, DIRECTORY, PROFILE }

@Composable
internal fun StaffMoreScreen() {
    val staff = LocalStaff.current
    var routeName by rememberSaveable { mutableStateOf<String?>(null) }
    val route = routeName?.let { MoreRoute.valueOf(it) }
    BackHandler(enabled = route != null) { routeName = null }
    if (route != null) {
        SubScreen(onBack = { routeName = null }) {
            when (route) {
                MoreRoute.TIMETABLE -> TimetableBody()
                MoreRoute.ANNOUNCEMENTS -> AnnouncementsBody()
                MoreRoute.FEES -> FeesBody()
                MoreRoute.DIRECTORY -> DirectoryBody()
                MoreRoute.PROFILE -> ProfileBody()
            }
        }
        return
    }
    StaffPage(ink = "More.", grey = "Everything else.") {
        MoreRow("My timetable") { routeName = MoreRoute.TIMETABLE.name }
        MoreRow("Announcements") { routeName = MoreRoute.ANNOUNCEMENTS.name }
        if (staff.me.canSeeFees) MoreRow("Fees") { routeName = MoreRoute.FEES.name }
        if (staff.me.canSeeStaff) MoreRow("Staff") { routeName = MoreRoute.DIRECTORY.name }
        MoreRow("Profile") { routeName = MoreRoute.PROFILE.name }
        PillButton(text = "Sign out", onClick = staff.onSignOut, kind = ButtonKind.SOLID, modifier = Modifier.fillMaxWidth().padding(top = 16.dp))
    }
}

@Composable
private fun MoreRow(title: String, onClick: () -> Unit) {
    TapCard(onClick = onClick) {
        Row(Modifier.heightIn(min = 32.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Krevo.colors.text, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Krevo.colors.textTertiary)
        }
    }
}

/** A pushed screen with a back arrow, scrolling with the standard gutters. */
@Composable
private fun SubScreen(onBack: () -> Unit, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    androidx.compose.foundation.layout.Box(Modifier.fillMaxWidth()) {
        androidx.compose.foundation.lazy.LazyColumn(
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Icon(Icons.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(40.dp).clip(CircleShape).clickable(onClick = onBack).padding(8.dp))
                    content()
                }
            }
        }
    }
}

// ---- My timetable

@Composable
private fun TimetableBody() {
    val staff = LocalStaff.current
    var day by rememberSaveable { mutableStateOf(StaffDates.today()) }
    val loader = rememberLoader(day) { staff.repo.myDay(day) }
    TwoToneTitle(ink = "My timetable.", grey = StaffDates.weekday(day) + ".")
    ChipRow(StaffDates.schoolWeek().map { it to (StaffDates.weekdayShort(it) + " " + it.takeLast(2)) }, day) { day = it }
    Loaded(loader) { entries ->
        if (entries.isEmpty()) EmptyNote("No classes this day.")
        entries.forEach { PeriodRow(it) }
    }
}

// ---- Announcements

@Composable
private fun AnnouncementsBody() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberLoader { staff.repo.broadcasts() }
    val scope = rememberCoroutineScope()
    var composing by remember { mutableStateOf(false) }
    TwoToneTitle(ink = "Announcements.", grey = "Sent to parents.")
    PillButton(text = "New announcement", onClick = { composing = true }, kind = ButtonKind.BRAND, modifier = Modifier.fillMaxWidth())
    Loaded(loader) { rows ->
        if (rows.isEmpty()) EmptyNote("Nothing sent yet.")
        rows.forEach { b ->
            FlatCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                    Text(b.title, style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f).padding(end = 8.dp))
                    Pill(if (b.scope == "school") "Whole school" else "Class ${b.classLabel.orEmpty()}")
                }
                Text(b.body, style = MaterialTheme.typography.bodyMedium, color = c.text, maxLines = 4, modifier = Modifier.padding(top = 8.dp))
                Text(
                    "${b.senderName} · ${StaffDates.instant(b.createdAt)} · read by ${b.readCount} of ${b.recipientCount}",
                    style = MaterialTheme.typography.bodySmall, color = c.textSecondary, modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
    if (composing) ComposeSheet(onDismiss = { composing = false }) { composing = false; scope.launch { loader.run() } }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ComposeSheet(onDismiss: () -> Unit, onSent: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val options = remember(staff.classes) { (if (staff.me.isAdmin) listOf("" to "Whole school") else emptyList()) + staff.announceClasses.map { it.id to "Class ${it.label}" } }
    var target by remember { mutableStateOf(options.firstOrNull()?.first ?: "") }
    var title by remember { mutableStateOf("") }
    var text by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.bg) {
        Column(Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("New announcement", style = MaterialTheme.typography.headlineSmall, color = c.text)
            SmallLabel("To")
            if (options.isEmpty()) Text("You have no classes to write to yet.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
            else ChipRow(options, target) { target = it }
            KrevoTextField(value = title, onValueChange = { title = it }, label = "Title")
            KrevoTextField(value = text, onValueChange = { text = it }, label = "Message", singleLine = false, modifier = Modifier.heightIn(min = 140.dp))
            error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.danger) }
            PillButton(
                text = "Send", kind = ButtonKind.BRAND, loading = busy, enabled = options.isNotEmpty(), modifier = Modifier.fillMaxWidth(),
                onClick = {
                    val t = title.trim(); val b = text.trim()
                    if (t.isEmpty() || b.isEmpty()) { error = "Add a title and a message."; return@PillButton }
                    scope.launch {
                        busy = true; error = null
                        try {
                            staff.repo.postBroadcast(t, b, target.ifEmpty { null })
                            haptic.success(); onSent()
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            error = e.message
                        }
                        busy = false
                    }
                },
            )
        }
    }
}

// ---- Fees

@Composable
private fun FeesBody() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val summary = rememberLoader { staff.repo.feesSummary() }
    var query by rememberSaveable { mutableStateOf("") }
    var debounced by remember { mutableStateOf("") }
    LaunchedEffect(query) { if (query.isNotEmpty()) delay(300); debounced = query }
    val dues = rememberLoader(debounced) { staff.repo.dues(debounced) }

    TwoToneTitle(ink = "Fees.", grey = "Collection and dues.")
    Loaded(summary) { s ->
        FlatCard {
            Text(rupees(s.collectedPaise), style = MaterialTheme.typography.headlineMedium, color = c.text)
            Text("collected of ${rupees(s.billedPaise)} billed" + (s.year?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
            LinearProgressIndicator(
                progress = { (((s.collectionPercentage ?: 0.0) / 100).coerceIn(0.0, 1.0)).toFloat() },
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp), color = c.accent, trackColor = c.fill,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column { Text("Dues", style = MaterialTheme.typography.bodySmall, color = c.textSecondary); Text(rupees(s.duesPaise), style = MaterialTheme.typography.titleSmall, color = c.text) }
                Column(horizontalAlignment = Alignment.End) { Text("Overdue", style = MaterialTheme.typography.bodySmall, color = c.textSecondary); Text(rupees(s.overduePaise), style = MaterialTheme.typography.titleSmall, color = c.danger) }
            }
        }
        if (s.topDues.isNotEmpty()) {
            SmallLabel("Most dues")
            s.topDues.take(3).forEach { d ->
                FlatCard {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Class ${d.classLabel}", style = MaterialTheme.typography.titleMedium, color = c.text)
                        Column(horizontalAlignment = Alignment.End) {
                            Text(rupees(d.duesPaise), style = MaterialTheme.typography.titleSmall, color = c.text)
                            Text("${d.students} students", style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
                        }
                    }
                }
            }
        }
    }
    SmallLabel("Students who owe fees")
    SearchField(query, { query = it }, "Search name or scholar number")
    Loaded(dues) { rows ->
        if (rows.isEmpty()) EmptyNote("No dues found.")
        rows.forEach { r ->
            FlatCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(r.studentName, style = MaterialTheme.typography.titleSmall, color = c.text)
                        Text(listOfNotNull(r.classLabel?.let { "Class $it" }, r.guardianName).joinToString(" · "), style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
                        if (r.overduePaise > 0) Text("${rupees(r.overduePaise)} overdue", style = MaterialTheme.typography.labelMedium, color = c.danger)
                    }
                    Text(rupees(r.duePaise), style = MaterialTheme.typography.titleSmall, color = c.text)
                    r.guardianPhone?.let { CallButton(it) }
                }
            }
        }
    }
}

// ---- Staff directory

@Composable
private fun DirectoryBody() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    var query by rememberSaveable { mutableStateOf("") }
    var debounced by remember { mutableStateOf("") }
    LaunchedEffect(query) { if (query.isNotEmpty()) delay(300); debounced = query }
    val loader = rememberLoader(debounced) { staff.repo.staff(debounced) }
    TwoToneTitle(ink = "Staff.", grey = "Your team.")
    SearchField(query, { query = it }, "Search by name")
    Loaded(loader) { rows ->
        if (rows.isEmpty()) EmptyNote("No one found.")
        rows.forEach { m ->
            FlatCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    NameAvatar(m.name, 40.dp)
                    Column(Modifier.weight(1f)) {
                        Text(m.name, style = MaterialTheme.typography.titleMedium, color = c.text)
                        Text(listOf(m.designation, m.department).filter { it.isNotEmpty() }.joinToString(" · "), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                    }
                    if (m.isAdmin) Pill("Admin", color = c.text)
                    m.phone?.takeIf { it.isNotEmpty() }?.let { CallButton(it) }
                }
            }
        }
    }
}

// ---- Profile

@Composable
private fun ProfileBody() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        NameAvatar(staff.me.name, 64.dp)
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(staff.me.name, style = MaterialTheme.typography.titleLarge, color = c.text)
            Pill(staff.me.roleTitle, color = c.text)
        }
    }
    FlatCard {
        KeyValue("Email", staff.me.email)
        staff.me.schoolName?.let { KeyValue("School", it) }
        KeyValue("Access", if (staff.me.isAdmin) "Full admin access" else "Teacher")
    }
    if (staff.me.assignments.isNotEmpty()) {
        SmallLabel("My classes")
        staff.me.assignments.forEach { a ->
            val label = staff.classes.firstOrNull { it.id == a.classId }?.label ?: "Class"
            FlatCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Class $label", style = MaterialTheme.typography.titleMedium, color = c.text)
                    Pill(if (a.role == "class_teacher") "Class teacher" else "Subject teacher")
                }
            }
        }
    }
    if (staff.me.permissions.isNotEmpty()) {
        SmallLabel("Permissions")
        FlatCard { Text(staff.me.permissions.joinToString(", ") { it.removeSuffix(".manage").replaceFirstChar { ch -> ch.uppercase() } }, style = MaterialTheme.typography.bodyMedium, color = c.text) }
    }
}
