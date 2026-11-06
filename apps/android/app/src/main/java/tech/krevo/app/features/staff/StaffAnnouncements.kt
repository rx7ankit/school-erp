package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoTextField
import tech.krevo.app.design.PillButton

/** Announcements sent to parents. Announcements access writes to the whole school and any class; every teacher writes to the classes they teach. */
@Composable
internal fun StaffAnnouncementsScreen(onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberLoader { staff.repo.broadcasts() }
    val scope = rememberCoroutineScope()
    var composing by remember { mutableStateOf(false) }

    PushedPage("Announcements", onBack) {
        PillButton(text = "New announcement", onClick = { composing = true }, kind = ButtonKind.BRAND, modifier = Modifier.fillMaxWidth())
        Loaded(loader) { rows ->
            if (rows.isEmpty()) EmptyNote("Nothing sent yet.")
            Column {
                rows.forEachIndexed { i, b ->
                    Column(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                            Text(b.title, style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f).padding(end = 8.dp))
                            Pill(if (b.scope == "school") "Whole school" else "Class ${b.classLabel.orEmpty()}")
                        }
                        Text(b.body, style = MaterialTheme.typography.bodyMedium, color = c.text, maxLines = 4)
                        Text(
                            "${b.senderName} · ${StaffDates.instant(b.createdAt)} · read by ${b.readCount} of ${b.recipientCount}",
                            style = MaterialTheme.typography.bodySmall, color = c.textSecondary,
                        )
                    }
                    if (i < rows.lastIndex) HorizontalDivider(color = c.separator)
                }
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
    val options = remember(staff.classes, staff.me) {
        (if (staff.me.canAnnounce) listOf("" to "Whole school") else emptyList()) + staff.announceClasses.map { it.id to "Class ${it.label}" }
    }
    var target by remember { mutableStateOf(options.firstOrNull()?.first ?: "") }
    androidx.compose.runtime.LaunchedEffect(options) { if (options.none { it.first == target }) target = options.firstOrNull()?.first ?: "" }
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
