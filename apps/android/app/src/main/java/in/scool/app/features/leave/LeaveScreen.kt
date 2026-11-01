package `in`.scool.app.features.leave

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import `in`.scool.app.R
import `in`.scool.app.data.Repository
import `in`.scool.app.design.ButtonKind
import `in`.scool.app.design.PillButton
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.StatusBadge
import `in`.scool.app.design.asString
import `in`.scool.app.design.loadContent
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.LeaveHalf
import `in`.scool.app.domain.LeaveRequest
import `in`.scool.app.domain.LeaveStatus

@Composable
private fun statusColor(s: LeaveStatus): Color = when (s) {
    LeaveStatus.PENDING -> Scool.colors.warning
    LeaveStatus.APPROVED -> Scool.colors.success
    LeaveStatus.REJECTED -> Scool.colors.danger
    LeaveStatus.CANCELLED -> Scool.colors.textSecondary
}

@Composable
private fun statusLabel(s: LeaveStatus): String = stringResource(
    when (s) {
        LeaveStatus.PENDING -> R.string.leave_pending
        LeaveStatus.APPROVED -> R.string.leave_approved
        LeaveStatus.REJECTED -> R.string.leave_rejected
        LeaveStatus.CANCELLED -> R.string.leave_cancelled
    },
)

@Composable
fun LeaveScreen(child: Child, repository: Repository, onApply: () -> Unit, onBack: () -> Unit) {
    val vm = leaveViewModel(repository, child.id)
    val state by vm.state.collectAsStateWithLifecycle()
    val ui by vm.ui.collectAsStateWithLifecycle()
    var confirmId by remember { mutableStateOf<String?>(null) }

    ScoolList {
        item {
            ScreenHeader(
                ink = stringResource(R.string.leave_title_ink),
                grey = stringResource(R.string.leave_title_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className),
                onBack = onBack,
            )
        }
        if (child.isActive) {
            item {
                PillButton(
                    text = stringResource(R.string.leave_apply),
                    onClick = onApply,
                    kind = ButtonKind.BRAND,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        } else {
            item {
                Text(
                    stringResource(R.string.leave_left_note, child.firstName),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Scool.colors.warning,
                )
            }
        }
        ui.error?.let { e ->
            item { Text(e.asString(), style = MaterialTheme.typography.bodyMedium, color = Scool.colors.danger) }
        }
        loadContent(state, onRetry = vm::refresh) { requests ->
            if (requests.isEmpty()) {
                item { Text(stringResource(R.string.leave_empty), style = MaterialTheme.typography.bodyLarge, color = Scool.colors.textSecondary) }
            }
            requests.forEach { r ->
                item(key = r.id) {
                    LeaveCard(
                        r,
                        canCancel = child.isActive && r.status == LeaveStatus.PENDING,
                        cancelling = ui.cancellingId == r.id,
                        busy = ui.cancellingId != null,
                        onCancel = { confirmId = r.id },
                    )
                }
            }
        }
    }

    confirmId?.let { id ->
        AlertDialog(
            onDismissRequest = { confirmId = null },
            containerColor = Scool.colors.bg,
            tonalElevation = 0.dp,
            title = { Text(stringResource(R.string.leave_cancel_title)) },
            text = { Text(stringResource(R.string.leave_cancel_body)) },
            confirmButton = {
                TextButton(onClick = { confirmId = null; vm.cancel(id) }, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text(stringResource(R.string.leave_cancel_confirm), color = Scool.colors.danger)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmId = null }, modifier = Modifier.heightIn(min = 48.dp)) {
                    Text(stringResource(R.string.leave_cancel_keep), color = Scool.colors.text)
                }
            },
        )
    }
}

@Composable
private fun LeaveCard(r: LeaveRequest, canCancel: Boolean, cancelling: Boolean, busy: Boolean, onCancel: () -> Unit) {
    val c = Scool.colors
    ScoolCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(Ist.range(r.fromOn, r.toOn), style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
            StatusBadge(statusLabel(r.status), statusColor(r.status), modifier = Modifier.padding(start = 8.dp))
        }
        when (r.half) {
            LeaveHalf.FIRST -> HalfNote(stringResource(R.string.leave_half_first))
            LeaveHalf.SECOND -> HalfNote(stringResource(R.string.leave_half_second))
            LeaveHalf.NONE -> Unit
        }
        Text(r.reason, style = MaterialTheme.typography.bodyLarge, color = c.text, modifier = Modifier.padding(top = 8.dp))
        r.decisionNote?.let {
            Text(
                stringResource(R.string.leave_note, it),
                style = MaterialTheme.typography.bodyMedium,
                color = c.textSecondary,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
        if (canCancel) {
            PillButton(
                text = stringResource(R.string.leave_cancel),
                onClick = onCancel,
                kind = ButtonKind.QUIET,
                enabled = !busy,
                loading = cancelling,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )
        }
    }
}

@Composable
private fun HalfNote(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = Scool.colors.textSecondary, modifier = Modifier.padding(top = 2.dp))
}
