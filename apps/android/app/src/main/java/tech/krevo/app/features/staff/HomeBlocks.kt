package tech.krevo.app.features.staff

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
 * The latest notice: title, one line of the text, who sent it and when, with its first photo on the left. The whole
 * block opens the Notices page (every notice, a page at a time).
 */
@Composable
internal fun NoticesBlock() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberReloading(staff.refresh) { staff.repo.broadcasts() }
    Column(Modifier.fillMaxWidth().clickable { staff.push(StaffDest.Notices) }) {
        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Notices", style = MaterialTheme.typography.titleLarge, color = c.text, modifier = Modifier.weight(1f))
            Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = c.textTertiary)
        }
        Loaded(loader, skeleton = { BlockSkeleton(72.dp) }) { rows ->
            val latest = rows.firstOrNull()
            if (latest == null) {
                Text("Nothing sent yet.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(vertical = 8.dp))
            } else {
                Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    latest.attachments.firstOrNull { it.isImage }?.let { NoticeThumb(it.id) { id -> staff.repo.attachmentUrl(id) } }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(latest.title, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(latest.body, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${latest.senderName} · ${StaffDates.instant(latest.createdAt)}", style = MaterialTheme.typography.bodySmall, color = c.textTertiary)
                    }
                }
            }
        }
    }
}

/** A rounded 64dp square of a notice's photo. */
@Composable
private fun NoticeThumb(id: String, urlFor: suspend (String) -> String) {
    val bitmap by rememberAttachmentBitmap(id, urlFor, sampleSize = 4)
    Box(Modifier.size(64.dp).clip(RoundedCornerShape(14.dp)).background(Krevo.colors.fill)) {
        bitmap?.let { Image(it.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
    }
}

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

// ---- Library

/** Books out and overdue, in one card. Only for people with the Library permission. */
@Composable
internal fun LibraryBlock(go: (StaffTab) -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberReloading(staff.refresh) { staff.repo.librarySummary() }
    Loaded(loader, skeleton = { BlockSkeleton(120.dp) }) { s ->
        NavCard("Library", onClick = { go(StaffTab.LIBRARY) }) {
            Row(Modifier.fillMaxWidth()) {
                Stat("Books", s.books.toString(), Modifier.weight(1f))
                Stat("On loan", s.onLoan.toString(), Modifier.weight(1f))
                Stat("Overdue", s.overdue.toString(), Modifier.weight(1f), tone = if (s.overdue > 0) c.danger else c.text)
            }
        }
    }
}

// ---- People

/** Who is on staff and how many logins are still to be sent. Opens People & access, a page of its own. */
@Composable
internal fun PeopleBlock() {
    val staff = LocalStaff.current
    val loader = rememberReloading(staff.refresh) { staff.repo.staff("") }
    Loaded(loader, skeleton = { BlockSkeleton(96.dp) }) { list ->
        NavCard("People & access", onClick = { staff.push(StaffDest.People) }) {
            val waiting = list.count { it.notSignedIn }
            Text(
                "${list.size} staff" + if (waiting > 0) " · $waiting not signed in yet" else "",
                style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary,
            )
        }
    }
}
