package tech.krevo.app.features.staff

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.Broadcast
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.Krevo
import tech.krevo.app.features.messages.AttachmentList

/**
 * One notice: the full text, each photo, who sent it and how many parents have read it. Opening it marks it read. When the
 * server says this person may change it (`can_edit`), a menu at the top right offers Edit and Delete.
 */
@Composable
internal fun StaffNoticeScreen(notice: Broadcast, onBack: () -> Unit) {
    val staff = LocalStaff.current
    val reads = LocalNoticeReads.current
    val c = Krevo.colors
    val scope = rememberCoroutineScope()
    var menu by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(notice.id) { reads.markRead(notice.id) }

    Column(Modifier.fillMaxSize()) {
        PushedHeader("", onBack, action = {
            if (notice.canEdit) {
                Column {
                    IconButton(onClick = { menu = true }, modifier = Modifier.size(48.dp)) {
                        Icon(Icons.Filled.MoreVert, contentDescription = "More", tint = c.text)
                    }
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(text = { Text("Edit") }, onClick = { menu = false; editing = true })
                        DropdownMenuItem(text = { Text("Delete", color = c.danger) }, onClick = { menu = false; confirmDelete = true })
                    }
                }
            }
        })
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(notice.title, style = MaterialTheme.typography.headlineMedium, color = c.text)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Pill(notice.audience)
                Text("${notice.senderName} · ${StaffDates.instant(notice.createdAt)}", style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
            }
            Text(notice.body, style = MaterialTheme.typography.bodyLarge, color = c.text)
            if (notice.attachments.isNotEmpty()) AttachmentList(notice.attachments, { staff.repo.attachmentUrl(it) }, c.text)
            HorizontalDivider(color = c.separator)
            KeyValue("Read by", "${notice.readCount} of ${notice.recipientCount}")
            error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.danger) }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { if (!deleting) confirmDelete = false },
            title = { Text("Delete this notice?") },
            text = { Text("It will be removed for everyone who received it. This can't be undone.") },
            confirmButton = {
                TextButton(enabled = !deleting, onClick = {
                    scope.launch {
                        deleting = true; error = null
                        try {
                            staff.repo.deleteBroadcast(notice.id)
                            confirmDelete = false
                            staff.back()   // the list underneath loads again
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            confirmDelete = false; error = e.message ?: "The notice could not be deleted."
                        }
                        deleting = false
                    }
                }) { Text("Delete", color = c.danger) }
            },
            dismissButton = { TextButton(enabled = !deleting, onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
    if (editing) {
        ComposeNoticeSheet(onDismiss = { editing = false }, editing = notice) { saved ->
            editing = false
            staff.replaceTop(StaffDest.Notice(saved))
        }
    }
}
