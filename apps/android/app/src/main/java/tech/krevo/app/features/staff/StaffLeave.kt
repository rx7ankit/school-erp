package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.StaffLeave
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoTextField
import tech.krevo.app.design.PillButton

/** Leave requests from parents. A class teacher (or someone with full access) approves or rejects pending ones. */
@Composable
internal fun StaffLeaveScreen(onBack: () -> Unit) {
    val staff = LocalStaff.current
    var filter by rememberSaveable { mutableStateOf("pending") }
    val loader = rememberLoader(filter) { staff.repo.leaves(filter) }
    var picked by remember { mutableStateOf<StaffLeave?>(null) }
    val scope = rememberCoroutineScope()

    PushedPage("Leave requests", onBack) {
        ChipRow(listOf("pending" to "Pending", "approved" to "Approved", "rejected" to "Rejected"), filter) { filter = it }
        Loaded(loader) { rows ->
            if (rows.isEmpty()) EmptyNote(if (filter == "pending") "Nothing waiting for you." else "No $filter requests.")
            rows.forEach { l ->
                TapCard(onClick = { picked = l }) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(l.studentName, style = MaterialTheme.typography.titleMedium, color = Krevo.colors.text, modifier = Modifier.weight(1f))
                        StatusPill(l.status)
                    }
                    Text(
                        listOfNotNull(l.classLabel?.let { "Class $it" }, StaffDates.range(l.fromOn, l.toOn)).joinToString(" · "),
                        style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary, modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(l.reason, style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.text, maxLines = 2, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
    }

    picked?.let { leave ->
        LeaveSheet(leave, onDismiss = { picked = null }) {
            picked = null
            scope.launch { loader.run(); staff.refreshPendingLeaves() }
        }
    }
    LaunchedEffect(filter) { staff.refreshPendingLeaves() }
}

@Composable
private fun StatusPill(status: String) {
    val c = Krevo.colors
    ToneChip(status.replaceFirstChar { it.uppercase() }, when (status) { "approved" -> c.success; "rejected" -> c.danger; else -> c.warning })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LeaveSheet(leave: StaffLeave, onDismiss: () -> Unit, onDone: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    var note by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun decide(approve: Boolean) {
        scope.launch {
            busy = true; error = null
            try {
                staff.repo.decideLeave(leave.id, approve, note)
                haptic.success(); onDone()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = e.message
            }
            busy = false
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.bg) {
        Column(Modifier.padding(horizontal = 24.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(leave.studentName, style = MaterialTheme.typography.headlineSmall, color = c.text)
            FlatCard {
                KeyValue("Class", leave.classLabel ?: "–")
                KeyValue("Dates", StaffDates.range(leave.fromOn, leave.toOn))
                if (leave.half != "none" && leave.half != "full") KeyValue("Half", leave.half.replaceFirstChar { it.uppercase() })
                KeyValue("Requested by", leave.guardianName)
                KeyValue("Sent", StaffDates.instant(leave.createdAt))
            }
            FlatCard { Text(leave.reason, style = MaterialTheme.typography.bodyLarge, color = c.text) }
            if (leave.status == "pending") {
                KrevoTextField(value = note, onValueChange = { note = it }, label = "Note to parent (optional)")
                error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.danger) }
                PillButton(text = "Approve", onClick = { decide(true) }, kind = ButtonKind.BRAND, loading = busy, modifier = Modifier.fillMaxWidth())
                PillButton(text = "Reject", onClick = { decide(false) }, kind = ButtonKind.SOLID, enabled = !busy, modifier = Modifier.fillMaxWidth())
            } else {
                StatusPill(leave.status)
                leave.decidedByName?.let { Text("Decided by $it", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary) }
                leave.decisionNote?.let { Text("“$it”", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary) }
            }
        }
    }
}
