package tech.krevo.app.design

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/*
 * Screen-specific skeletons. Each mirrors the real layout (same card shapes, paddings and number of rows) so the
 * content swaps in without anything moving. They are passed to loadContent(skeleton = ...) and so render inside a
 * SkeletonHost, a column spaced 12dp like KrevoList. All neutral grey.
 */

/** A card with a small label, one value line and one caption: the Home cards. */
@Composable
private fun LabelValueCard(valueWidth: androidx.compose.ui.unit.Dp = 160.dp, captionWidth: androidx.compose.ui.unit.Dp = 130.dp) {
    val t = MaterialTheme.typography
    SkeletonCard {
        SkeletonLine(width = 90.dp, style = t.labelMedium)
        SkeletonLine(modifier = Modifier.padding(top = 4.dp), width = valueWidth, style = t.headlineSmall)
        SkeletonLine(width = captionWidth, style = t.bodyMedium)
    }
}

/** Home: today, fees, latest result, latest notice cards. */
@Composable
fun HomeSkeleton() {
    val t = MaterialTheme.typography
    LabelValueCard(valueWidth = 150.dp, captionWidth = 110.dp)
    LabelValueCard(valueWidth = 170.dp, captionWidth = 120.dp)
    LabelValueCard(valueWidth = 190.dp, captionWidth = 200.dp)
    SkeletonCard {
        SkeletonLine(width = 100.dp, style = t.labelMedium)
        SkeletonLine(modifier = Modifier.padding(top = 4.dp), fraction = 0.7f, style = t.titleMedium)
        SkeletonLine(width = 90.dp, style = t.bodySmall)
        SkeletonLine(modifier = Modifier.padding(top = 4.dp), style = t.bodyMedium)
        SkeletonLine(style = t.bodyMedium)
        SkeletonLine(fraction = 0.6f, style = t.bodyMedium)
    }
}

/** Attendance: month calendar card, legend, stat cards. */
@Composable
fun AttendanceSkeleton() {
    val t = MaterialTheme.typography
    KrevoCard(contentPadding = PaddingValues(horizontal = 8.dp, vertical = 12.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            repeat(7) {
                Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    SkeletonLine(width = 12.dp, style = t.labelMedium)
                }
            }
        }
        repeat(5) {
            Row(modifier = Modifier.fillMaxWidth()) {
                repeat(7) {
                    Box(modifier = Modifier.weight(1f).height(48.dp), contentAlignment = Alignment.Center) {
                        SkeletonBox(width = 18.dp, height = 14.dp)
                    }
                }
            }
        }
    }
    Column {
        SkeletonLine(modifier = Modifier.padding(bottom = 6.dp), width = 230.dp, style = t.bodySmall)
        SkeletonLine(modifier = Modifier.padding(bottom = 6.dp), width = 200.dp, style = t.bodySmall)
        SkeletonLine(width = 180.dp, style = t.bodySmall)
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SkeletonStatGrid()
        SkeletonLine(fraction = 0.8f, style = t.bodySmall)
    }
}

/** Fees list: invoice cards (period + status badge, amount, invoice line) and the pay-at-school note. */
@Composable
fun FeesSkeleton() {
    val t = MaterialTheme.typography
    repeat(3) {
        SkeletonCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonLine(width = 130.dp, style = t.titleLarge)
                SkeletonPill(width = 72.dp)
            }
            SkeletonLine(modifier = Modifier.padding(top = 8.dp), width = 150.dp, style = t.headlineMedium)
            SkeletonLine(width = 210.dp, style = t.bodyMedium)
        }
    }
    SkeletonLine(fraction = 0.85f, style = t.bodyMedium)
}

/** One label-left / value-right row like InfoRow (min height 40 + 6dp padding top and bottom). */
@Composable
private fun InfoRowSkeleton(labelWidth: androidx.compose.ui.unit.Dp = 110.dp, valueWidth: androidx.compose.ui.unit.Dp = 80.dp) {
    val t = MaterialTheme.typography
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 40.dp).padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SkeletonLine(width = labelWidth, style = t.bodyMedium)
        SkeletonLine(width = valueWidth, style = t.titleSmall)
    }
}

/** Invoice detail: header, status card, items card, payments card. */
@Composable
fun InvoiceSkeleton() {
    val t = MaterialTheme.typography
    SkeletonCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            SkeletonLine(width = 60.dp, style = t.labelMedium)
            SkeletonPill(width = 72.dp)
        }
        InfoRowSkeleton()
    }
    SkeletonCard {
        SkeletonLine(width = 70.dp, style = t.labelMedium)
        repeat(3) { InfoRowSkeleton() }
        HorizontalDivider(color = Krevo.colors.separator, modifier = Modifier.padding(vertical = 4.dp))
        repeat(3) { InfoRowSkeleton(labelWidth = 80.dp) }
    }
    SkeletonCard {
        SkeletonLine(width = 80.dp, style = t.labelMedium)
        Column(modifier = Modifier.padding(top = 6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonLine(width = 120.dp, style = t.bodyMedium)
                SkeletonLine(width = 70.dp, style = t.titleSmall)
            }
            SkeletonLine(width = 200.dp, style = t.bodyMedium)
            SkeletonLine(width = 150.dp, style = t.bodyMedium)
            SkeletonBox(modifier = Modifier.padding(top = 8.dp), height = 52.dp, shape = CircleShape)
        }
    }
}

/** Results list: exam cards (name + published line on the left, percentage on the right). */
@Composable
fun ResultsSkeleton() {
    val t = MaterialTheme.typography
    repeat(4) {
        SkeletonCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    SkeletonLine(width = 170.dp, style = t.titleLarge)
                    SkeletonLine(width = 150.dp, style = t.bodyMedium)
                }
                SkeletonLine(modifier = Modifier.padding(start = 12.dp), width = 64.dp, style = t.headlineMedium)
            }
        }
    }
}

/** Result detail (the screen header stays real): subject table, total, remark, published line, download button. */
@Composable
fun ResultDetailSkeleton() {
    val t = MaterialTheme.typography
    SkeletonCard {
        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
            Box(modifier = Modifier.weight(1f)) { SkeletonLine(width = 60.dp, style = t.labelMedium) }
            Box(modifier = Modifier.weight(0.6f)) { SkeletonLine(width = 44.dp, style = t.labelMedium) }
            SkeletonLine(width = 40.dp, style = t.labelMedium)
        }
        repeat(6) {
            HorizontalDivider(color = Krevo.colors.separator)
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.weight(1f)) { SkeletonLine(width = 100.dp, style = t.bodyLarge) }
                Box(modifier = Modifier.weight(0.6f)) { SkeletonLine(width = 60.dp, style = t.bodyLarge) }
                SkeletonPill(width = 40.dp)
            }
        }
    }
    SkeletonCard {
        SkeletonLine(width = 60.dp, style = t.labelMedium)
        SkeletonLine(modifier = Modifier.padding(top = 4.dp), width = 130.dp, style = t.headlineMedium)
        SkeletonLine(width = 170.dp, style = t.bodyMedium)
    }
    SkeletonCard {
        SkeletonLine(width = 70.dp, style = t.labelMedium)
        SkeletonLine(modifier = Modifier.padding(top = 4.dp), style = t.bodyLarge)
        SkeletonLine(fraction = 0.6f, style = t.bodyLarge)
    }
    SkeletonLine(width = 190.dp, style = t.bodySmall)
    SkeletonBox(height = 52.dp, shape = CircleShape)
}

/** Timetable: Monday to Saturday header, then period rows (same column widths as the real grid). */
@Composable
fun TimetableSkeleton() {
    val t = MaterialTheme.typography
    Column(modifier = Modifier.horizontalScroll(rememberScrollState())) {
        Row {
            Box(modifier = Modifier.width(92.dp))
            repeat(6) {
                Box(modifier = Modifier.width(116.dp).padding(horizontal = 2.dp).heightIn(min = 40.dp), contentAlignment = Alignment.Center) {
                    SkeletonBox(height = 24.dp, shape = RoundedCornerShape(Radius.control))
                }
            }
        }
        repeat(6) {
            Row(modifier = Modifier.padding(top = 4.dp)) {
                Column(modifier = Modifier.width(92.dp).padding(end = 6.dp)) {
                    SkeletonLine(width = 56.dp, style = t.titleSmall)
                    SkeletonLine(width = 40.dp, style = t.bodySmall)
                    SkeletonLine(width = 40.dp, style = t.bodySmall)
                }
                repeat(6) {
                    Box(modifier = Modifier.width(116.dp).padding(horizontal = 2.dp)) {
                        SkeletonBox(height = 64.dp, shape = RoundedCornerShape(Radius.control))
                    }
                }
            }
        }
    }
}

/** Leave requests: date range + status badge, reason lines. */
@Composable
fun LeaveSkeleton() {
    val t = MaterialTheme.typography
    repeat(3) {
        SkeletonCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonLine(width = 150.dp, style = t.titleMedium)
                SkeletonPill(width = 72.dp)
            }
            SkeletonLine(modifier = Modifier.padding(top = 8.dp), style = t.bodyLarge)
            SkeletonLine(fraction = 0.55f, style = t.bodyLarge)
        }
    }
}

/** Messages: pinned updates row, "Teachers" label, teacher thread cards. */
@Composable
fun MessagesSkeleton() {
    val t = MaterialTheme.typography
    SkeletonCard {
        Row(modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                SkeletonLine(width = 110.dp, style = t.titleLarge)
                SkeletonLine(modifier = Modifier.padding(top = 2.dp), style = t.bodyMedium)
                SkeletonLine(fraction = 0.6f, style = t.bodyMedium)
                SkeletonLine(modifier = Modifier.padding(top = 2.dp), width = 110.dp, style = t.bodySmall)
            }
        }
    }
    SkeletonLine(modifier = Modifier.padding(top = 4.dp), width = 80.dp, style = t.labelMedium)
    repeat(3) { ThreadCardSkeleton() }
}

@Composable
private fun ThreadCardSkeleton() {
    val t = MaterialTheme.typography
    SkeletonCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SkeletonCircle(44.dp)
            Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
                SkeletonLine(width = 130.dp, style = t.titleMedium)
                SkeletonPill(modifier = Modifier.padding(top = 2.dp), width = 80.dp)
                SkeletonLine(modifier = Modifier.padding(top = 4.dp), fraction = 0.8f, style = t.bodyMedium)
            }
            SkeletonLine(width = 48.dp, style = t.bodySmall)
        }
    }
}

/** Updates feed: filter chip row, then update cards (sender + tag, text, time). */
@Composable
fun UpdatesSkeleton() {
    val t = MaterialTheme.typography
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SkeletonBox(width = 64.dp, height = 48.dp, shape = CircleShape)
        SkeletonBox(width = 88.dp, height = 48.dp, shape = CircleShape)
        SkeletonBox(width = 96.dp, height = 48.dp, shape = CircleShape)
        SkeletonBox(width = 88.dp, height = 48.dp, shape = CircleShape)
    }
    repeat(3) {
        SkeletonCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonLine(width = 130.dp, style = t.titleSmall)
                SkeletonPill(width = 70.dp)
            }
            SkeletonLine(modifier = Modifier.padding(top = 8.dp), style = t.bodyLarge)
            SkeletonLine(fraction = 0.7f, style = t.bodyLarge)
            SkeletonLine(modifier = Modifier.padding(top = 8.dp), width = 120.dp, style = t.bodySmall)
        }
    }
}

/** Notices / calendar / exam cards: title, date, body lines. */
@Composable
fun NoticesSkeleton() {
    val t = MaterialTheme.typography
    repeat(3) {
        SkeletonCard {
            SkeletonLine(fraction = 0.6f, style = t.titleLarge)
            SkeletonLine(modifier = Modifier.padding(top = 2.dp), width = 130.dp, style = t.bodySmall)
            SkeletonLine(modifier = Modifier.padding(top = 8.dp), style = t.bodyLarge)
            SkeletonLine(style = t.bodyLarge)
            SkeletonLine(fraction = 0.5f, style = t.bodyLarge)
        }
    }
}

/** Notifications: unread summary row with a quiet button, then notification cards (icon, title, body, time). */
@Composable
fun NotificationsSkeleton() {
    val t = MaterialTheme.typography
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SkeletonLine(width = 100.dp, style = t.bodyMedium)
        SkeletonBox(width = 140.dp, height = 52.dp, shape = CircleShape)
    }
    repeat(4) {
        SkeletonCard {
            Row(verticalAlignment = Alignment.Top) {
                SkeletonCircle(40.dp)
                Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                    SkeletonLine(fraction = 0.7f, style = t.titleMedium)
                    SkeletonLine(modifier = Modifier.padding(top = 2.dp), style = t.bodyMedium)
                    SkeletonLine(modifier = Modifier.padding(top = 6.dp), width = 110.dp, style = t.bodySmall)
                }
            }
        }
    }
}

/** Feedback requests: title + chip, closing date. */
@Composable
fun FeedbackSkeleton() {
    val t = MaterialTheme.typography
    repeat(3) {
        SkeletonCard {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonLine(modifier = Modifier.weight(1f), fraction = 0.7f, style = t.titleMedium)
                SkeletonPill(modifier = Modifier.padding(start = 8.dp), width = 90.dp)
            }
            SkeletonLine(modifier = Modifier.padding(top = 4.dp), width = 160.dp, style = t.bodyMedium)
        }
    }
}

/** Feedback form: request line, one card per teacher (name, subject, stars, comment box, counter), submit button. */
@Composable
fun FeedbackRatingSkeleton() {
    val t = MaterialTheme.typography
    SkeletonLine(fraction = 0.8f, style = t.bodyMedium)
    repeat(2) {
        SkeletonCard {
            SkeletonLine(width = 140.dp, style = t.titleMedium)
            SkeletonLine(width = 100.dp, style = t.bodyMedium)
            SkeletonBox(modifier = Modifier.padding(top = 8.dp), width = 200.dp, height = 40.dp, shape = CircleShape)
            SkeletonBox(modifier = Modifier.padding(top = 8.dp), height = 56.dp, shape = RoundedCornerShape(Radius.control))
            SkeletonLine(modifier = Modifier.padding(top = 4.dp), width = 40.dp, style = t.bodySmall)
        }
    }
    SkeletonBox(height = 52.dp, shape = CircleShape)
}

/** Chat: alternating message bubbles. */
@Composable
fun ChatSkeleton() {
    val widths = listOf(220.dp, 160.dp, 250.dp, 190.dp, 140.dp)
    widths.forEachIndexed { i, w ->
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (i % 2 == 0) Arrangement.Start else Arrangement.End) {
            SkeletonBox(width = w, height = 56.dp, shape = RoundedCornerShape(Radius.card))
        }
    }
}

/** Whole-page placeholder used before a child is selected: big title lines and a generic list. */
@Composable
fun PageSkeleton(modifier: Modifier = Modifier) {
    val t = MaterialTheme.typography
    SkeletonHost(modifier = modifier.fillMaxSize().padding(start = 20.dp, end = 20.dp, top = 8.dp)) {
        Column(modifier = Modifier.padding(vertical = 8.dp)) {
            SkeletonLine(fraction = 0.55f, style = t.headlineLarge)
            SkeletonLine(modifier = Modifier.padding(top = 4.dp), fraction = 0.3f, style = t.headlineLarge)
        }
        SkeletonList(rows = 4)
    }
}
