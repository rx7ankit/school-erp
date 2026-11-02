package tech.slov.app.features.feedback

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import tech.slov.app.R
import tech.slov.app.design.Slov
import tech.slov.app.domain.FEEDBACK_MAX_STARS
import kotlin.math.roundToInt

/**
 * Five tappable stars (48dp targets). Selected stars are orange, the rest grey.
 * TalkBack reads "Rating, 3 of 5 stars" and the control adjusts like a slider.
 * Pass [onValueChange] = null for a read-only display.
 */
@Composable
fun StarRating(
    value: Int,
    onValueChange: ((Int) -> Unit)?,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val c = Slov.colors
    val interactive = onValueChange != null && enabled
    val ratingLabel = stringResource(R.string.rating)
    val ratingState = stringResource(R.string.rating_state, value, FEEDBACK_MAX_STARS)
    Row(
        modifier = modifier.clearAndSetSemantics {
            contentDescription = ratingLabel
            stateDescription = ratingState
            progressBarRangeInfo = ProgressBarRangeInfo(value.toFloat(), 0f..FEEDBACK_MAX_STARS.toFloat(), FEEDBACK_MAX_STARS - 1)
            if (interactive) {
                setProgress { target ->
                    onValueChange?.invoke(target.roundToInt().coerceIn(1, FEEDBACK_MAX_STARS))
                    true
                }
            }
        },
    ) {
        for (star in 1..FEEDBACK_MAX_STARS) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .let { if (interactive) it.clickable { onValueChange?.invoke(star) } else it },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.Star,
                    contentDescription = null,
                    tint = if (star <= value) c.accent else c.separator,
                    modifier = Modifier.size(32.dp),
                )
            }
        }
    }
}
