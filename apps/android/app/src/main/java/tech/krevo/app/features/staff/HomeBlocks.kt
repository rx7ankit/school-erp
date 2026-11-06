package tech.krevo.app.features.staff

import androidx.compose.foundation.background
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.text.font.FontWeight
import tech.krevo.app.data.staff.Broadcast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import tech.krevo.app.features.messages.rememberAttachmentBitmap
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import tech.krevo.app.data.staff.DayEntry
import tech.krevo.app.data.staff.PeriodStatus
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.periodStatuses
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.Radius

// The cards on the staff Home. Each loads its own small request, so a slow block never holds up the others.

/** A grey placeholder the size of a block, while it loads. */
@Composable
internal fun BlockSkeleton(height: Dp) {
    Box(Modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(Radius.card)).background(Krevo.colors.card))
}

/** A grey card that opens something: a title with a chevron, then [content]. */
@Composable
private fun NavCard(title: String, onClick: () -> Unit, content: @Composable () -> Unit) {
    TapCard(onClick = onClick) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = Krevo.colors.text, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Krevo.colors.textTertiary)
        }
        Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier = Modifier, tone: Color = Krevo.colors.text) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary)
        Text(value, style = MaterialTheme.typography.titleLarge, color = tone, maxLines = 1)
    }
}

// ---- My day

/** Today's periods as cards to swipe through, each with a chip: Now, Next, Done or Cover. */
@Composable
internal fun MyDayBlock(hideIfEmpty: Boolean) {
    val staff = LocalStaff.current
    val loader = rememberReloading(staff.refresh) { staff.repo.myDay(StaffDates.today()) }
    if (hideIfEmpty && loader.state.value?.isEmpty() == true) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BlockTitle("Today's classes", "Timetable") { staff.push(StaffDest.Timetable) }
        Loaded(loader, skeleton = { BlockSkeleton(132.dp) }) { entries ->
            if (entries.isEmpty()) {
                Text("No classes scheduled today.", style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary)
            } else {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    periodStatuses(entries, StaffDates.nowHm()).forEach { (e, status) -> PeriodCard(e, status) }
                }
            }
        }
    }
}

@Composable
private fun PeriodCard(e: DayEntry, status: PeriodStatus) {
    val c = Krevo.colors
    Surface(
        modifier = Modifier.width(210.dp), shape = RoundedCornerShape(Radius.card), color = c.card, tonalElevation = 0.dp, shadowElevation = 0.dp,
        border = if (status == PeriodStatus.NOW) BorderStroke(1.5.dp, c.accent) else null,
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Pill(StaffDates.clock(e.startsAt))
                when (status) {
                    PeriodStatus.COVER -> ToneChip("Cover", c.warning)
                    PeriodStatus.NOW -> ToneChip("Now", c.success)
                    PeriodStatus.NEXT -> ToneChip("Next", c.warning)
                    PeriodStatus.DONE -> Pill("Done")
                    PeriodStatus.LATER -> Unit
                }
            }
            Text(e.subjectName, style = MaterialTheme.typography.titleLarge, color = if (status == PeriodStatus.DONE) c.textSecondary else c.text, maxLines = 1)
            HorizontalDivider(color = c.separator)
            Text("Class ${e.classLabel}", style = MaterialTheme.typography.titleSmall, color = c.text)
            Text(e.periodName, style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
        }
    }
}

// ---- Notices

/**
 * "Notices" and an orange "View all" on one row, and under it the latest five as a row of cards that snap one at a time.
 * The row breaks out of the page's side padding (the caller gives this block the full screen width), so the cards run off
 * both edges. A whole card opens that notice.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun NoticesBlock() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberReloading(staff.refresh) { staff.repo.broadcasts() }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Notices", style = MaterialTheme.typography.titleLarge, color = c.text, modifier = Modifier.weight(1f))
            Text(
                "View all", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, color = c.accent,
                modifier = Modifier.clickable { staff.push(StaffDest.Notices) }.padding(vertical = 8.dp),
            )
        }
        Loaded(loader, skeleton = { Box(Modifier.padding(horizontal = 20.dp)) { BlockSkeleton(NOTICE_CARD_HEIGHT) } }) { rows ->
            val latest = rows.take(5)
            if (latest.isEmpty()) {
                Box(
                    Modifier.padding(horizontal = 20.dp).fillMaxWidth().height(NOTICE_CARD_HEIGHT).clip(RoundedCornerShape(NOTICE_RADIUS)).background(c.card),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("Nothing sent yet.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                }
            } else {
                BoxWithConstraints(Modifier.fillMaxWidth()) {
                    val state = rememberLazyListState()
                    LazyRow(
                        Modifier.fillMaxWidth(), state = state,
                        contentPadding = PaddingValues(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        flingBehavior = rememberSnapFlingBehavior(state),
                    ) {
                        items(latest, key = { it.id }) { b -> NoticeCard(b, NOTICE_CARD_HEIGHT, Modifier.width(maxWidth * 0.55f)) { staff.push(StaffDest.Notice(b)) } }
                    }
                }
            }
        }
    }
}

private val NOTICE_CARD_HEIGHT = 170.dp

// ---- Fees

/** Fee collection in one card. Only for people with the Fees permission. */
@Composable
internal fun FeesBlock(go: (StaffTab) -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberReloading(staff.refresh) { staff.repo.feesSummary() }
    Loaded(loader, skeleton = { BlockSkeleton(150.dp) }) { f ->
        if (f.billedPaise > 0) NavCard("Fees", onClick = { go(StaffTab.FEES) }) {
            Text(rupees(f.collectedPaise), style = MaterialTheme.typography.headlineMedium, color = c.text)
            ThinProgress(((f.collectionPercentage ?: 0.0) / 100).coerceIn(0.0, 1.0).toFloat())
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("of ${rupees(f.billedPaise)} billed", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                if (f.overduePaise > 0) Text("${rupees(f.overduePaise)} overdue", style = MaterialTheme.typography.titleSmall, color = c.danger)
            }
        }
    }
}
