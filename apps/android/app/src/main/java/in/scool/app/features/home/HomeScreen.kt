package `in`.scool.app.features.home

import androidx.compose.ui.res.stringResource
import `in`.scool.app.R
import `in`.scool.app.features.notifications.hasUnread
import `in`.scool.app.features.notifications.notificationsViewModel
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.background
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.app.VmFactory
import `in`.scool.app.data.Repository
import `in`.scool.app.design.Avatar
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.SectionLabel
import `in`.scool.app.design.TwoToneTitle
import `in`.scool.app.design.loadContent
import `in`.scool.app.domain.AttendanceStatus
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.Money
import `in`.scool.app.domain.percent
import `in`.scool.app.features.feedback.feedbackViewModel
import `in`.scool.app.features.profile.LeftSchoolBanner
import `in`.scool.app.domain.Load

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    child: Child,
    children: List<Child>,
    repository: Repository,
    onSelectChild: (String) -> Unit,
    onOpenAttendance: () -> Unit,
    onOpenResults: () -> Unit,
    onOpenFees: () -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenFeedback: () -> Unit,
) {
    val vm: HomeViewModel = viewModel(
        key = "home-${child.id}",
        factory = VmFactory { HomeViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()
    val refreshing by vm.refreshing.collectAsStateWithLifecycle()
    val feedbackVm = feedbackViewModel(repository, child.id)
    val feedback by feedbackVm.state.collectAsStateWithLifecycle()
    val notificationsVm = notificationsViewModel(repository)
    val notifications by notificationsVm.state.collectAsStateWithLifecycle()
    val hasUnread = notifications.hasUnread(child.id)
    val pendingClosesOn = ((feedback as? Load.Data)?.value ?: emptyList()).filter { it.pending }.minOfOrNull { it.closesOn }

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { vm.refresh(); feedbackVm.refresh(); notificationsVm.refresh() },
        modifier = Modifier.fillMaxWidth(),
    ) {
        ScoolList {
            item {
                HomeTopBar(child = child, children = children, onSelectChild = onSelectChild, hasUnread = hasUnread, onOpenNotifications = onOpenNotifications)
            }
            item {
                TwoToneTitle(
                    ink = stringResource(greetingRes(), child.firstName),
                    grey = stringResource(R.string.home_subtitle),
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            }
            if (!child.isActive) item { LeftSchoolBanner(child) }
            if (pendingClosesOn != null) {
                item {
                    ScoolCard(onClick = onOpenFeedback) {
                        SectionLabel(stringResource(R.string.feedback_requested))
                        Text(
                            stringResource(R.string.notif_feedback_body, child.firstName),
                            style = MaterialTheme.typography.titleMedium,
                            color = Scool.colors.text,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        Text(
                            stringResource(R.string.feedback_closes, Ist.date(pendingClosesOn)),
                            style = MaterialTheme.typography.bodyMedium,
                            color = Scool.colors.textSecondary,
                        )
                    }
                }
            }
            loadContent(state, onRetry = vm::refresh) { data ->
                item {
                    val (label, color) = attendanceLabel(data.today.status)
                    ScoolCard(onClick = onOpenAttendance) {
                        SectionLabel(stringResource(R.string.home_today))
                        Text(label, style = MaterialTheme.typography.headlineSmall, color = color, modifier = Modifier.padding(top = 4.dp))
                        data.today.markedAt?.let {
                            Text(
                                stringResource(R.string.home_marked_at, Ist.time(it)),
                                style = MaterialTheme.typography.bodyMedium,
                                color = Scool.colors.textSecondary,
                            )
                        }
                    }
                }
                item {
                    ScoolCard(onClick = onOpenFees) {
                        SectionLabel(stringResource(R.string.home_fees))
                        if (data.fees.duePaise == 0L) {
                            Text(stringResource(R.string.home_all_paid), style = MaterialTheme.typography.headlineSmall, color = Scool.colors.success, modifier = Modifier.padding(top = 4.dp))
                        } else {
                            Text(
                                stringResource(R.string.home_due, Money.format(data.fees.duePaise)),
                                style = MaterialTheme.typography.headlineSmall,
                                color = Scool.colors.text,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                            data.fees.nextDueOn?.let {
                                Text(stringResource(R.string.home_due_by, Ist.date(it)), style = MaterialTheme.typography.bodyMedium, color = Scool.colors.textSecondary)
                            }
                        }
                    }
                }
                item {
                    ScoolCard(onClick = onOpenResults) {
                        SectionLabel(stringResource(R.string.home_latest_result))
                        val r = data.latestResult
                        if (r == null) {
                            Text(stringResource(R.string.home_no_results), style = MaterialTheme.typography.bodyLarge, color = Scool.colors.textSecondary, modifier = Modifier.padding(top = 4.dp))
                        } else {
                            Text(r.name, style = MaterialTheme.typography.headlineSmall, color = Scool.colors.text, modifier = Modifier.padding(top = 4.dp))
                            Text(
                                stringResource(R.string.home_result_line, percent(r.percentage), Ist.dateOfInstant(r.publishedAt)),
                                style = MaterialTheme.typography.bodyMedium,
                                color = Scool.colors.textSecondary,
                            )
                        }
                    }
                }
                item {
                    ScoolCard(onClick = onOpenNotices) {
                        SectionLabel(stringResource(R.string.home_latest_notice))
                        val n = data.latestNotice
                        if (n == null) {
                            Text(stringResource(R.string.home_no_notices), style = MaterialTheme.typography.bodyLarge, color = Scool.colors.textSecondary, modifier = Modifier.padding(top = 4.dp))
                        } else {
                            Text(n.title, style = MaterialTheme.typography.titleMedium, color = Scool.colors.text, modifier = Modifier.padding(top = 4.dp))
                            Text(
                                Ist.dateOfInstant(n.publishedAt),
                                style = MaterialTheme.typography.bodySmall,
                                color = Scool.colors.textSecondary,
                            )
                            Text(
                                n.body,
                                style = MaterialTheme.typography.bodyMedium,
                                color = Scool.colors.textSecondary,
                                maxLines = 3,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun greetingRes(): Int {
    val h = Ist.hourNow()
    return when {
        h < 12 -> R.string.home_greeting_morning
        h < 17 -> R.string.home_greeting_afternoon
        else -> R.string.home_greeting_evening
    }
}

@Composable
private fun attendanceLabel(status: AttendanceStatus): Pair<String, Color> {
    val c = Scool.colors
    val (res, color) = when (status) {
        AttendanceStatus.PRESENT -> R.string.att_today_present to c.success
        AttendanceStatus.ABSENT -> R.string.att_today_absent to c.danger
        AttendanceStatus.HALF_FIRST -> R.string.att_today_half_first to c.warning
        AttendanceStatus.HALF_SECOND -> R.string.att_today_half_second to c.warning
        AttendanceStatus.LEAVE -> R.string.att_today_leave to c.textSecondary
        AttendanceStatus.HOLIDAY -> R.string.att_today_holiday to c.textSecondary
        AttendanceStatus.NOT_MARKED -> R.string.att_today_not_marked to c.textTertiary
    }
    return stringResource(res) to color
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeTopBar(
    child: Child,
    children: List<Child>,
    onSelectChild: (String) -> Unit,
    hasUnread: Boolean,
    onOpenNotifications: () -> Unit,
) {
    var sheetOpen by remember { mutableStateOf(false) }
    val canSwitch = children.size > 1
    val c = Scool.colors
    val switcherDescription = stringResource(if (canSwitch) R.string.home_child_switch else R.string.home_child, child.firstName)
    val switchLabel = stringResource(R.string.home_switch_child)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val switcherModifier = Modifier
            .heightIn(min = 48.dp)
            .let {
                if (canSwitch) {
                    it.clickable(onClickLabel = switchLabel, role = Role.Button) { sheetOpen = true }
                } else {
                    it
                }
            }
            .semantics(mergeDescendants = true) {
                contentDescription = switcherDescription
            }
        Row(modifier = switcherModifier, verticalAlignment = Alignment.CenterVertically) {
            Avatar(initials = child.initials, size = 36.dp)
            Spacer(Modifier.width(8.dp))
            Text(child.firstName, style = MaterialTheme.typography.titleMedium, color = c.text)
            if (canSwitch) {
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, tint = c.textSecondary)
            }
        }
        val bellLabel = stringResource(if (hasUnread) R.string.home_notifications_unread else R.string.home_notifications)
        IconButton(onClick = onOpenNotifications, modifier = Modifier.size(48.dp)) {
            Box {
                Icon(Icons.Filled.Notifications, contentDescription = bellLabel, tint = c.text)
                if (hasUnread) {
                    Box(
                        modifier = Modifier
                            .size(9.dp)
                            .align(Alignment.TopEnd)
                            .background(c.accent, CircleShape),
                    )
                }
            }
        }
    }

    if (sheetOpen) {
        ModalBottomSheet(
            onDismissRequest = { sheetOpen = false },
            sheetState = rememberModalBottomSheetState(),
            containerColor = c.bg,
            contentColor = c.text,
            tonalElevation = 0.dp,
            shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
        ) {
            Column(modifier = Modifier.navigationBarsPadding().padding(horizontal = 20.dp, vertical = 8.dp)) {
                Text(stringResource(R.string.home_switch_child), style = MaterialTheme.typography.titleLarge, color = c.text, modifier = Modifier.padding(bottom = 8.dp))
                children.forEach { option ->
                    val selected = option.id == child.id
                    val optionDescription = stringResource(
                        if (selected) R.string.home_option_selected else R.string.home_option, option.name, option.className,
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 56.dp)
                            .clickable(role = Role.Button) {
                                onSelectChild(option.id)
                                sheetOpen = false
                            }
                            .semantics(mergeDescendants = true) { contentDescription = optionDescription },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Avatar(initials = option.initials, size = 40.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(option.name, style = MaterialTheme.typography.titleMedium, color = c.text)
                            Text(stringResource(R.string.home_class, option.className), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                        }
                        if (selected) Icon(Icons.Filled.Check, contentDescription = null, tint = c.text)
                    }
                }
            }
        }
    }
}
