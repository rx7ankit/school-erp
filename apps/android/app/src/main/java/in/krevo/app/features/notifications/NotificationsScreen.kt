package `in`.krevo.app.features.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import `in`.krevo.app.R
import `in`.krevo.app.data.Repository
import `in`.krevo.app.design.ButtonKind
import `in`.krevo.app.design.Chip
import `in`.krevo.app.design.PillButton
import `in`.krevo.app.design.Krevo
import `in`.krevo.app.design.KrevoCard
import `in`.krevo.app.design.KrevoList
import `in`.krevo.app.design.ScreenHeader
import `in`.krevo.app.design.SegmentedControl
import `in`.krevo.app.design.loadContent
import `in`.krevo.app.domain.AppNotification
import `in`.krevo.app.domain.Child
import `in`.krevo.app.domain.Ist
import `in`.krevo.app.domain.Money
import `in`.krevo.app.domain.NotificationType

private fun iconFor(type: NotificationType): ImageVector = when (type) {
    NotificationType.ATTENDANCE_PRESENT -> Icons.Filled.Check
    NotificationType.ATTENDANCE_ABSENT -> Icons.Filled.Warning
    NotificationType.ATTENDANCE_FIRST_HALF, NotificationType.ATTENDANCE_SECOND_HALF,
    NotificationType.EXAM_DATE_SHEET, NotificationType.LEAVE_APPROVED, NotificationType.LEAVE_REJECTED -> Icons.Filled.DateRange
    NotificationType.FEE_REMINDER -> Icons.Filled.ShoppingCart
    NotificationType.NOTICE, NotificationType.BROADCAST, NotificationType.MESSAGE -> Icons.Filled.Info
    NotificationType.RESULT_PUBLISHED, NotificationType.REPORT_CARD, NotificationType.FEEDBACK_REQUESTED,
    NotificationType.PROMOTION_PROMOTED, NotificationType.PROMOTION_STAYED, NotificationType.PROMOTION_COMPLETED -> Icons.Filled.Star
}

/** Title and one-line body, built from the notification fields so they follow the app language. */
@Composable
fun notificationTitle(n: AppNotification): String = when (n.type) {
    NotificationType.ATTENDANCE_PRESENT -> stringResource(R.string.notif_present, n.childName)
    NotificationType.ATTENDANCE_ABSENT -> stringResource(R.string.notif_absent, n.childName)
    NotificationType.ATTENDANCE_FIRST_HALF -> stringResource(R.string.notif_first_half, n.childName)
    NotificationType.ATTENDANCE_SECOND_HALF -> stringResource(R.string.notif_second_half, n.childName)
    NotificationType.LEAVE_APPROVED -> stringResource(R.string.notif_leave_approved, n.childName)
    NotificationType.LEAVE_REJECTED -> stringResource(R.string.notif_leave_rejected, n.childName)
    NotificationType.REPORT_CARD -> stringResource(R.string.notif_report_card, n.childName)
    NotificationType.FEE_REMINDER -> stringResource(
        R.string.notif_fee, Money.format(n.amountPaise ?: 0L), n.childName, n.dueOn?.let { Ist.date(it) }.orEmpty(),
    )
    NotificationType.NOTICE -> stringResource(R.string.notif_notice_title)
    // "{Sender} · {Subject}" for a teacher broadcast, "School notice" for a school-level one, the teacher's name for a message.
    NotificationType.BROADCAST ->
        if (n.sender == null) stringResource(R.string.notif_school_notice)
        else stringResource(R.string.notif_broadcast, n.sender, n.subject ?: stringResource(R.string.msg_tag_general))
    NotificationType.MESSAGE -> n.sender.orEmpty()
    NotificationType.PROMOTION_PROMOTED ->
        stringResource(R.string.notif_promoted, n.childName, n.className.orEmpty(), n.year.orEmpty())
    NotificationType.PROMOTION_STAYED ->
        stringResource(R.string.notif_stayed, n.childName, n.className.orEmpty(), n.year.orEmpty())
    NotificationType.PROMOTION_COMPLETED ->
        stringResource(R.string.notif_completed, n.childName, n.className.orEmpty())
    NotificationType.EXAM_DATE_SHEET -> stringResource(R.string.notif_exam_title)
    NotificationType.RESULT_PUBLISHED -> stringResource(R.string.notif_result_title)
    NotificationType.FEEDBACK_REQUESTED -> stringResource(R.string.feedback_requested)
}

@Composable
fun notificationBody(n: AppNotification): String = when (n.type) {
    NotificationType.ATTENDANCE_PRESENT, NotificationType.ATTENDANCE_ABSENT,
    NotificationType.ATTENDANCE_FIRST_HALF, NotificationType.ATTENDANCE_SECOND_HALF ->
        stringResource(R.string.notif_marked_at, Ist.time(n.at))
    NotificationType.FEE_REMINDER -> stringResource(R.string.fees_pay_at_school)
    NotificationType.NOTICE, NotificationType.LEAVE_APPROVED, NotificationType.LEAVE_REJECTED,
    NotificationType.REPORT_CARD -> n.subject.orEmpty()
    NotificationType.BROADCAST, NotificationType.MESSAGE -> n.preview.orEmpty()
    NotificationType.PROMOTION_PROMOTED, NotificationType.PROMOTION_STAYED, NotificationType.PROMOTION_COMPLETED -> ""
    NotificationType.EXAM_DATE_SHEET -> stringResource(R.string.notif_exam_body, n.subject.orEmpty(), n.childName)
    NotificationType.RESULT_PUBLISHED -> stringResource(R.string.notif_result_body, n.subject.orEmpty(), n.childName)
    NotificationType.FEEDBACK_REQUESTED -> stringResource(R.string.notif_feedback_body, n.childName)
}

@Composable
fun NotificationsScreen(
    child: Child,
    repository: Repository,
    onOpen: (AppNotification) -> Unit,
    onBack: () -> Unit,
) {
    val vm = notificationsViewModel(repository)
    val state by vm.state.collectAsStateWithLifecycle()
    var showAll by rememberSaveable { mutableStateOf(false) }
    val resources = LocalContext.current.resources

    KrevoList {
        item {
            ScreenHeader(
                ink = stringResource(R.string.notif_title_ink),
                grey = stringResource(R.string.notif_title_grey),
                onBack = onBack,
            )
        }
        item {
            SegmentedControl(
                options = listOf(child.firstName, stringResource(R.string.notif_all_children)),
                selectedIndex = if (showAll) 1 else 0,
                onSelect = { showAll = it == 1 },
            )
        }
        loadContent(state, onRetry = vm::refresh) { all ->
            val shown = if (showAll) all else all.filter { it.childId == child.id }
            val unread = shown.count { !it.read }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        resources.getQuantityString(R.plurals.notif_unread, unread, unread),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Krevo.colors.textSecondary,
                        modifier = Modifier.weight(1f),
                    )
                    PillButton(
                        text = stringResource(R.string.notif_mark_all_read),
                        onClick = vm::markAllRead,
                        kind = ButtonKind.QUIET,
                        enabled = unread > 0,
                    )
                }
            }
            if (shown.isEmpty()) {
                item { Text(stringResource(R.string.notif_empty), style = MaterialTheme.typography.bodyLarge, color = Krevo.colors.textSecondary) }
            }
            shown.forEach { n ->
                item(key = n.id) { NotificationCard(n, showChildTag = n.childId != child.id, onClick = { onOpen(n) }) }
            }
        }
    }
}

@Composable
private fun NotificationCard(n: AppNotification, showChildTag: Boolean, onClick: () -> Unit) {
    val c = Krevo.colors
    val unreadText = stringResource(R.string.notif_unread_state)
    KrevoCard(
        onClick = onClick,
        modifier = if (n.read) Modifier else Modifier.semantics { stateDescription = unreadText },
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Box(
                modifier = Modifier.size(40.dp).background(c.fill, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(iconFor(n.type), contentDescription = null, tint = c.textSecondary, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(notificationTitle(n), style = MaterialTheme.typography.titleMedium, color = c.text)
                val body = notificationBody(n)
                if (body.isNotEmpty()) {
                    Text(body, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(top = 2.dp))
                }
                Row(
                    modifier = Modifier.padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(Ist.dateTime(n.at), style = MaterialTheme.typography.bodySmall, color = c.textTertiary)
                    if (showChildTag) Chip(n.childName)
                }
            }
            if (!n.read) {
                Box(Modifier.padding(start = 8.dp, top = 6.dp).size(10.dp).background(c.accent, CircleShape))
            }
        }
    }
}
