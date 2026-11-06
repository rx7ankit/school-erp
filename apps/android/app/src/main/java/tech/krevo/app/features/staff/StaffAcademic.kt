package tech.krevo.app.features.staff

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.nextPeriod
import tech.krevo.app.data.staff.noSchoolReason
import tech.krevo.app.design.Krevo

private val Gap = 12.dp
private val SmallTile = 100.dp

/**
 * The Academic tab, for whoever holds the Academic permission: bento tiles of different sizes. A large orange tile for
 * Classes, then Students, Timetable, Leave requests and Announcements, each showing one live number or line.
 */
@Composable
internal fun StaffAcademicScreen() {
    val staff = LocalStaff.current
    val today = StaffDates.today()
    val overview = rememberReloading(staff.refresh) { staff.repo.dayOverview(today) }
    val dashboard = rememberReloading(staff.refresh) { staff.repo.dashboard() }
    val day = rememberReloading(staff.refresh) { staff.repo.myDay(today) }
    val notices = rememberReloading(staff.refresh) { staff.repo.broadcasts() }

    val o = overview.state.value
    val off = o?.let { noSchoolReason(it.holiday, StaffDates.isSunday(today)) }
    val next = day.state.value?.let { nextPeriod(it, StaffDates.nowHm()) }

    RootPage {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Gap)) {
            // The hero is as tall as the two small tiles beside it and the gap between them.
            Tile(Modifier.weight(1.15f).height(SmallTile * 2 + Gap), onClick = { staff.push(StaffDest.Classes) }, color = Krevo.colors.accent, onColor = Krevo.colors.onAccent) {
                Label("Classes")
                if (o == null) {
                    Big("–")
                } else if (off != null && o.classesMarked == 0) {
                    Big("No school")
                    Note(off)
                } else {
                    Big(o.percentage?.let { String.format(java.util.Locale.ENGLISH, "%.0f%%", it) } ?: "–")
                    Note("attendance today")
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.Bottom) {
                        Note("${o.classesMarked} of ${o.classesTotal} classes marked")
                        ThinProgress(
                            if (o.classesTotal == 0) 0f else o.classesMarked.toFloat() / o.classesTotal, Modifier.padding(top = 8.dp),
                            color = Krevo.colors.onAccent, track = Krevo.colors.onAccent.copy(alpha = 0.3f),
                        )
                    }
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Gap)) {
                Tile(Modifier.height(SmallTile), onClick = { staff.push(StaffDest.Students) }) {
                    Label("Students")
                    Big(dashboard.state.value?.students?.toString() ?: "–")
                }
                Tile(Modifier.height(SmallTile), onClick = { staff.push(StaffDest.Timetable) }) {
                    Label("Timetable")
                    Text(
                        if (day.state.value == null) "–" else next?.subjectName ?: "Free",
                        style = MaterialTheme.typography.titleLarge, color = Krevo.colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    )
                    next?.let { Note("Class ${it.classLabel} · ${StaffDates.clock(it.startsAt)}", Krevo.colors.textSecondary) }
                }
            }
        }
        if (staff.me.canDecideLeave) {
            Tile(Modifier.fillMaxWidth(), onClick = { staff.push(StaffDest.Leave) }) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Label("Leave requests")
                        Note(if (staff.pendingLeaves == 0) "Nothing waiting" else "Waiting for a decision", Krevo.colors.textSecondary)
                    }
                    if (staff.pendingLeaves > 0) CountBadge(staff.pendingLeaves)
                }
            }
        }
        Tile(Modifier.fillMaxWidth().height(SmallTile), onClick = { staff.push(StaffDest.Announcements) }) {
            Label("Announcements")
            val latest = notices.state.value?.firstOrNull()
            Text(
                if (notices.state.value == null) "–" else latest?.title ?: "Nothing sent yet",
                style = MaterialTheme.typography.titleMedium, color = Krevo.colors.text, maxLines = 2, overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** One bento tile: a rounded block that opens a page. */
@Composable
private fun Tile(
    modifier: Modifier, onClick: () -> Unit, color: Color = Krevo.colors.card, onColor: Color = Krevo.colors.text,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    TapSurface(onClick = onClick, color = color, shape = RoundedCornerShape(28.dp), modifier = modifier) {
        androidx.compose.runtime.CompositionLocalProvider(LocalTileInk provides onColor) {
            Column(Modifier.padding(16.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp), content = content)
        }
    }
}

/** The ink of the tile being drawn: white on the orange one, black on the grey ones. */
private val LocalTileInk = androidx.compose.runtime.compositionLocalOf { Color.Unspecified }

@Composable
private fun Label(text: String) {
    Text(text, style = MaterialTheme.typography.labelLarge, color = LocalTileInk.current.copy(alpha = 0.75f), maxLines = 1)
}

@Composable
private fun Big(text: String) {
    Text(text, style = MaterialTheme.typography.headlineMedium, color = LocalTileInk.current, maxLines = 1)
}

@Composable
private fun Note(text: String, color: Color = LocalTileInk.current) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = color.copy(alpha = 0.85f), maxLines = 2, overflow = TextOverflow.Ellipsis)
}
