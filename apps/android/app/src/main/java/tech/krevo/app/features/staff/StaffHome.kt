package tech.krevo.app.features.staff

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.border
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import tech.krevo.app.data.staff.HomeLayout
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.Krevo

/**
 * The staff Home: the school and the person at the top, then a stack of blocks. The server decides from the person's
 * permissions which blocks they get (`GET /home/layout`); [HomeLayout.homeBlocks] puts them in order. A block this build
 * does not know is skipped.
 */
@Composable
internal fun StaffHomeScreen(go: (StaffTab) -> Unit) {
    val staff = LocalStaff.current
    var showProfile by remember { mutableStateOf(false) }

    // The Academic pieces share one load of the dashboard, the 14-day trend and today's overview.
    val academic = if (HomeLayout.ACADEMIC in staff.layout.blocks) rememberReloading(staff.refresh) { staff.repo.academicSnapshot() } else null

    RootPage {
        HomeHeader(onProfile = { showProfile = true })
        staff.layout.homeBlocks().forEach { name ->
            key(name) {
                when (name) {
                    HomeLayout.MY_ATTENDANCE -> MyAttendanceCard()
                    HomeLayout.ACADEMIC -> academic?.let { AcademicHeroBlock(it, go) }
                    HomeLayout.NOTICES -> NoticesBlock()
                    HomeLayout.MY_DAY -> MyDayBlock(hideIfEmpty = staff.layout.hasWorkBlocks)
                    HomeLayout.MY_CLASSES -> MyClassesBlock()
                    HomeLayout.ACADEMIC_STATS -> academic?.let { AcademicStatsBlock(it) }
                    "fees" -> FeesBlock(go)
                    "library" -> LibraryBlock(go)
                    "people" -> PeopleBlock()
                }
            }
        }
    }
    if (showProfile) ProfileSheet(onDismiss = { showProfile = false })
}

/** The school's logo and name with the date under it, and the person's own picture on the right: tap it for their profile. */
@Composable
private fun HomeHeader(onProfile: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val school = staff.me.schoolName ?: "Krevo"
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        SchoolMark(school, staff.me.schoolLogoUrl, 48.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(school, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(StaffDates.date(StaffDates.today()), style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
        }
        Box(
            Modifier.padding(start = 8.dp).size(48.dp).clip(CircleShape).border(1.dp, c.separator, CircleShape).clickable(onClick = onProfile)
                .semantics { contentDescription = "Your profile" },
            contentAlignment = Alignment.Center,
        ) { PersonAvatar(staff.me.name, staff.me.photoUrl, 40.dp) }
    }
}

/** Title of a Home block, with an optional link on the right. */
@Composable
internal fun BlockTitle(title: String, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Text(title, style = MaterialTheme.typography.titleLarge, color = Krevo.colors.text)
        if (action != null) {
            Text(action + "  →", style = MaterialTheme.typography.labelLarge, color = Krevo.colors.textSecondary, modifier = Modifier.clickable(onClick = onAction).padding(vertical = 8.dp))
        }
    }
}
