package tech.slov.app.features.more

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import tech.slov.app.R
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import tech.slov.app.design.Slov
import tech.slov.app.design.SlovCard
import tech.slov.app.design.SlovList
import tech.slov.app.design.ScreenHeader

@Composable
fun MoreScreen(
    feedbackPending: Boolean,
    leavePending: Int,
    onLeave: () -> Unit,
    onTimetable: () -> Unit,
    onFees: () -> Unit,
    onNotices: () -> Unit,
    onFeedback: () -> Unit,
    onProfile: () -> Unit,
    onSettings: () -> Unit,
) {
    SlovList {
        item { ScreenHeader(ink = stringResource(R.string.more_title_ink), grey = stringResource(R.string.more_title_grey)) }
        item { MoreRow(stringResource(R.string.more_fees), stringResource(R.string.more_fees_sub), onFees) }
        item { MoreRow(stringResource(R.string.more_notices), stringResource(R.string.more_notices_sub), onNotices) }
        item {
            val leaveSub = if (leavePending > 0) {
                LocalContext.current.resources.getQuantityString(R.plurals.more_leave_pending, leavePending, leavePending)
            } else {
                stringResource(R.string.more_leave_sub)
            }
            MoreRow(stringResource(R.string.more_leave), leaveSub, onLeave)
        }
        item { MoreRow(stringResource(R.string.more_timetable), stringResource(R.string.more_timetable_sub), onTimetable) }
        item { MoreRow(stringResource(R.string.more_feedback), stringResource(R.string.more_feedback_sub), onFeedback, dot = feedbackPending) }
        item { MoreRow(stringResource(R.string.more_profile), stringResource(R.string.more_profile_sub), onProfile) }
        item { MoreRow(stringResource(R.string.more_settings), stringResource(R.string.more_settings_sub), onSettings) }
    }
}

@Composable
private fun MoreRow(title: String, subtitle: String, onClick: () -> Unit, dot: Boolean = false) {
    val requested = stringResource(R.string.feedback_requested)
    SlovCard(
        onClick = onClick,
        modifier = if (dot) Modifier.semantics { stateDescription = requested } else Modifier,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            androidx.compose.foundation.layout.Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = Slov.colors.text)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = Slov.colors.textSecondary)
            }
            if (dot) {
                Box(Modifier.padding(end = 8.dp).size(10.dp).background(Slov.colors.accent, CircleShape))
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Slov.colors.textTertiary)
        }
    }
}
