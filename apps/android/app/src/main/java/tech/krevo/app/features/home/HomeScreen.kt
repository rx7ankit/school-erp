package tech.krevo.app.features.home

import tech.krevo.app.design.HomeSkeleton
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.ui.semantics.clearAndSetSemantics
import tech.krevo.app.domain.AppNotification
import tech.krevo.app.domain.promotionCard
import tech.krevo.app.features.notifications.notificationTitle
import androidx.compose.ui.res.stringResource
import tech.krevo.app.R
import tech.krevo.app.features.notifications.hasUnread
import tech.krevo.app.features.notifications.notificationsViewModel
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
import androidx.compose.foundation.layout.height
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
import tech.krevo.app.app.VmFactory
import tech.krevo.app.data.Repository
import tech.krevo.app.design.Avatar
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoCard
import tech.krevo.app.design.KrevoList
import tech.krevo.app.design.SectionLabel
import tech.krevo.app.design.TwoToneTitle
import tech.krevo.app.design.loadContent
import tech.krevo.app.domain.AttendanceStatus
import androidx.compose.ui.text.style.TextOverflow
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.Ist
import tech.krevo.app.domain.Money
import tech.krevo.app.domain.percent
import tech.krevo.app.features.feedback.feedbackViewModel
import tech.krevo.app.features.profile.LeftSchoolBanner
import tech.krevo.app.domain.Load
import androidx.compose.foundation.border
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Email
import androidx.compose.ui.platform.LocalContext
import tech.krevo.app.features.notices.NoticeDetail
import tech.krevo.app.features.notices.NoticeSheet
import tech.krevo.app.features.notices.detail
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.ui.text.font.FontWeight
import tech.krevo.app.design.Chip
import tech.krevo.app.design.Radius
import tech.krevo.app.domain.ExamSummary
import tech.krevo.app.domain.Notice

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    child: Child,
    children: List<Child>,
    repository: Repository,
    onSelectChild: (String) -> Unit,
    onOpenAttendance: () -> Unit,
    onOpenTimetable: () -> Unit,
    onOpenResults: () -> Unit,
    onOpenFees: () -> Unit,
    onOpenMessages: () -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenFeedback: () -> Unit,
    dismissedPromotions: Set<String>,
    onDismissPromotion: (String) -> Unit,
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
    val promotion = ((notifications as? Load.Data)?.value ?: emptyList()).promotionCard(child.id, dismissedPromotions)
    val pendingClosesOn = ((feedback as? Load.Data)?.value ?: emptyList()).filter { it.pending }.minOfOrNull { it.closesOn }

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { vm.refresh(); feedbackVm.refresh(); notificationsVm.refresh() },
        modifier = Modifier.fillMaxWidth(),
    ) {
        KrevoList {
            item {
                HomeTopBar(
                    child = child, children = children, onSelectChild = onSelectChild,
                    hasUnread = hasUnread, onOpenNotifications = onOpenNotifications,
                )
            }
            if (!child.isActive) item { LeftSchoolBanner(child) }
            if (promotion != null) {
                item(key = "promotion-${promotion.id}") { PromotionCard(promotion, onDismiss = { onDismissPromotion(promotion.id) }) }
            }
            if (pendingClosesOn != null) {
                item {
                    KrevoCard(onClick = onOpenFeedback) {
                        SectionLabel(stringResource(R.string.feedback_requested))
                        Text(
                            stringResource(R.string.notif_feedback_body, child.firstName),
                            style = MaterialTheme.typography.titleMedium,
                            color = Krevo.colors.text,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        Text(
                            stringResource(R.string.feedback_closes, Ist.date(pendingClosesOn)),
                            style = MaterialTheme.typography.bodyMedium,
                            color = Krevo.colors.textSecondary,
                        )
                    }
                }
            }
            loadContent(state, onRetry = vm::refresh, skeleton = { HomeSkeleton() }) { data ->
                if (data.latestNotices.isNotEmpty()) item { NoticeSlider(data.latestNotices) }
                if (data.unreadMessages > 0) item { NewMessageBox(data.unreadMessages, data.unreadFrom, onOpenMessages) }
                item { WeekCard(data.week, data.today.status, onOpenAttendance) }
                item { TodayClassesCard(data.classes, onSeeAll = onOpenTimetable) }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Max)) {
                        FeesTile(data.fees, onOpenFees, Modifier.weight(1f).fillMaxHeight())
                        ResultTile(data.latestResult, onOpenResults, Modifier.weight(1f).fillMaxHeight())
                    }
                }
            }
        }
    }
}

/** The latest five school notices as a swipeable row of soft orange cards, with page dots. Tap one for the full text. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun NoticeSlider(notices: List<Notice>) {
    val c = Krevo.colors
    val pager = rememberPagerState(pageCount = { notices.size })
    var open by remember { mutableStateOf<NoticeDetail?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HorizontalPager(
            state = pager, modifier = Modifier.fillMaxWidth(), pageSpacing = 12.dp, verticalAlignment = Alignment.Top,
        ) { page -> NoticeCard(notices[page], onClick = { open = notices[page].detail() }) }
        if (notices.size > 1) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                repeat(notices.size) { i ->
                    val on = pager.currentPage == i
                    Box(
                        Modifier.padding(horizontal = 3.dp).size(if (on) 8.dp else 6.dp)
                            .background(if (on) c.solid else c.separator, CircleShape),
                    )
                }
            }
        }
    }
    open?.let { NoticeSheet(it, onDismiss = { open = null }) }
}

@Composable
private fun NoticeCard(n: Notice, onClick: () -> Unit) {
    val c = Krevo.colors
    val isNew = Ist.daysSince(n.publishedAt) <= 2
    Surface(
        onClick = onClick, shape = RoundedCornerShape(Radius.card), color = c.accentSubtle,
        tonalElevation = 0.dp, shadowElevation = 0.dp, modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.Notifications, contentDescription = null, tint = c.accent, modifier = Modifier.size(16.dp))
                Text(stringResource(R.string.home_latest_notice).uppercase(), style = MaterialTheme.typography.labelMedium, color = c.accent)
                if (isNew) Chip(stringResource(R.string.home_new))
                Spacer(Modifier.weight(1f))
                Text(Ist.dateOfInstant(n.publishedAt), style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
            }
            Text(n.title, style = MaterialTheme.typography.titleLarge, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(n.body, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** A small tinted box under the notices when a teacher has written and it has not been read. Opens the Messages tab. */
@Composable
private fun NewMessageBox(count: Int, from: String?, onClick: () -> Unit) {
    val c = Krevo.colors
    val text = if (count > 1 || from == null) {
        LocalContext.current.resources.getQuantityString(R.plurals.home_new_messages, count, count)
    } else {
        stringResource(R.string.home_new_message_from, from)
    }
    Surface(
        onClick = onClick, shape = RoundedCornerShape(Radius.card), color = c.accentSubtle,
        tonalElevation = 0.dp, shadowElevation = 0.dp, modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(Icons.Filled.Email, contentDescription = null, tint = c.accent, modifier = Modifier.size(22.dp))
            Text(text, style = MaterialTheme.typography.titleSmall, color = c.text, modifier = Modifier.weight(1f))
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = c.textTertiary)
        }
    }
}

@Composable
private fun WeekCard(week: List<WeekDay>, today: AttendanceStatus, onClick: () -> Unit) {
    val c = Krevo.colors
    KrevoCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.home_this_week), style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
            val (label, color) = attendanceLabel(today)
            Text(label, style = MaterialTheme.typography.labelLarge, color = color)
        }
        Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            week.forEach { day -> WeekDayCell(day, Modifier.weight(1f)) }
        }
        val marked = week.any { it.status != AttendanceStatus.NOT_MARKED && it.status != AttendanceStatus.HOLIDAY }
        val present = week.count { it.status == AttendanceStatus.PRESENT }
        val absent = week.count { it.status == AttendanceStatus.ABSENT }
        Text(
            if (marked) stringResource(R.string.home_week_summary, present.toString(), absent.toString()) else stringResource(R.string.home_week_empty),
            style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(top = 12.dp),
        )
    }
}

@Composable
private fun WeekDayCell(day: WeekDay, modifier: Modifier) {
    val c = Krevo.colors
    val (tint, mark) = when (day.status) {
        AttendanceStatus.PRESENT -> c.success to "✓"
        AttendanceStatus.ABSENT -> c.danger to "✕"
        AttendanceStatus.HALF_FIRST, AttendanceStatus.HALF_SECOND -> c.warning to "½"
        AttendanceStatus.LEAVE -> c.warning to "L"
        AttendanceStatus.HOLIDAY -> c.textTertiary to "–"
        AttendanceStatus.NOT_MARKED -> c.textTertiary to ""
    }
    val quiet = day.isFuture || day.status == AttendanceStatus.NOT_MARKED
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(Ist.dayName(day.date.dayOfWeek), style = MaterialTheme.typography.labelMedium, color = if (day.isToday) c.text else c.textSecondary)
        Box(
            modifier = Modifier
                .size(38.dp)
                .background(if (quiet) c.fill else tint.copy(alpha = 0.16f), CircleShape)
                .let { if (day.isToday) it.border(2.dp, c.text, CircleShape) else it },
            contentAlignment = Alignment.Center,
        ) {
            if (!quiet && mark.isNotEmpty()) Text(mark, color = tint, style = MaterialTheme.typography.titleSmall)
        }
        Text(
            day.date.dayOfMonth.toString(), style = MaterialTheme.typography.labelMedium,
            color = if (day.isToday) c.text else c.textTertiary, fontWeight = if (day.isToday) FontWeight.Bold else FontWeight.Normal,
        )
    }
}

@Composable
private fun TodayClassesCard(classes: List<TodayPeriod>, onSeeAll: () -> Unit) {
    val c = Krevo.colors
    KrevoCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.home_todays_classes), style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
            TextButton(onClick = onSeeAll) { Text(stringResource(R.string.home_see_all), color = c.textSecondary) }
        }
        if (classes.isEmpty()) {
            Text(stringResource(R.string.home_no_school), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(top = 4.dp))
        } else {
            val now = java.time.LocalTime.now(java.time.ZoneId.of("Asia/Kolkata"))
            Column(Modifier.padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                classes.forEach { item ->
                    val isNow = !now.isBefore(item.period.start) && now.isBefore(item.period.end)
                    Row(
                        Modifier.fillMaxWidth()
                            .background(if (isNow) c.accentSubtle else Color.Transparent, RoundedCornerShape(14.dp))
                            .padding(horizontal = 8.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Column(Modifier.width(52.dp)) {
                            Text(item.period.start.toString(), style = MaterialTheme.typography.titleSmall, color = c.text)
                            Text(item.period.end.toString(), style = MaterialTheme.typography.bodySmall, color = c.textTertiary)
                        }
                        Box(Modifier.width(3.dp).height(36.dp).background(if (isNow) c.accent else c.separator, CircleShape))
                        Column(Modifier.weight(1f)) {
                            Text(item.subject, style = MaterialTheme.typography.titleMedium, color = c.text)
                            Text(item.cover ?: item.teacher, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                        }
                        when {
                            item.cover != null -> Chip(stringResource(R.string.home_cover))
                            isNow -> Chip(stringResource(R.string.home_now))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FeesTile(fees: FeesSummary, onClick: () -> Unit, modifier: Modifier) {
    val c = Krevo.colors
    Surface(onClick = onClick, shape = RoundedCornerShape(Radius.card), color = c.card, tonalElevation = 0.dp, shadowElevation = 0.dp, modifier = modifier) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.home_fees).uppercase(), style = MaterialTheme.typography.labelMedium, color = c.textSecondary)
            if (fees.duePaise == 0L) {
                Text(stringResource(R.string.home_fees_all_paid), style = MaterialTheme.typography.titleLarge, color = c.success)
            } else {
                Text(Money.format(fees.duePaise), style = MaterialTheme.typography.titleLarge, color = c.text, maxLines = 1)
                fees.nextDueOn?.let {
                    val overdue = it.isBefore(Ist.today())
                    Text(stringResource(R.string.home_due_by, Ist.date(it)), style = MaterialTheme.typography.bodySmall, color = if (overdue) c.danger else c.textSecondary)
                }
            }
        }
    }
}

@Composable
private fun ResultTile(r: ExamSummary?, onClick: () -> Unit, modifier: Modifier) {
    val c = Krevo.colors
    Surface(onClick = onClick, shape = RoundedCornerShape(Radius.card), color = c.card, tonalElevation = 0.dp, shadowElevation = 0.dp, modifier = modifier) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(stringResource(R.string.home_latest_result).uppercase(), style = MaterialTheme.typography.labelMedium, color = c.textSecondary)
            if (r == null) {
                Text(stringResource(R.string.home_no_results), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
            } else {
                Text(percent(r.percentage), style = MaterialTheme.typography.titleLarge, color = c.text)
                Text(r.name, style = MaterialTheme.typography.bodySmall, color = c.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** Flat congratulations card for 14 days after a promotion or completion. Dismissible; the choice is remembered. */
@Composable
private fun PromotionCard(n: AppNotification, onDismiss: () -> Unit) {
    val c = Krevo.colors
    KrevoCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(40.dp).background(c.fill, CircleShape).clearAndSetSemantics { },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Star, contentDescription = null, tint = c.textSecondary, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
            Text(notificationTitle(n), style = MaterialTheme.typography.titleMedium, color = c.text, modifier = Modifier.weight(1f))
            IconButton(onClick = onDismiss, modifier = Modifier.size(48.dp)) {
                Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.home_promotion_dismiss), tint = c.textSecondary)
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
    val c = Krevo.colors
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
    val c = Krevo.colors
    val switcherDescription = stringResource(if (canSwitch) R.string.home_child_switch else R.string.home_child, child.firstName)
    val switchLabel = stringResource(R.string.home_switch_child)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val switcherModifier = Modifier
            .weight(1f, fill = false)
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
            Text(child.firstName, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            if (canSwitch) {
                Icon(Icons.Filled.KeyboardArrowDown, contentDescription = null, tint = c.textSecondary)
            }
        }
        val bellLabel = stringResource(if (hasUnread) R.string.home_notifications_unread else R.string.home_notifications)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            IconButton(onClick = onOpenNotifications, modifier = Modifier.size(48.dp)) {
                Box {
                    Icon(Icons.Filled.Notifications, contentDescription = bellLabel, tint = c.text)
                    if (hasUnread) {
                        Box(
                            modifier = Modifier
                                .size(9.dp)
                                .align(Alignment.TopEnd)
                                .background(c.danger, CircleShape),
                        )
                    }
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
