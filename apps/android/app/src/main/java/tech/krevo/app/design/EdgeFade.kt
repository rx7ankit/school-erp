package tech.krevo.app.design

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Fades the left and right edges of a horizontally scrolling row out to nothing over [fade]. The left fade shows only
 * once the row has scrolled past its start, the right one only while more content remains, so a row that fits (or sits
 * at its start) is untouched. [canScrollBack] / [canScrollForward] are read while drawing, so a scroll does not recompose.
 */
fun Modifier.horizontalEdgeFade(canScrollBack: () -> Boolean, canScrollForward: () -> Boolean, fade: Dp = 24.dp): Modifier =
    this
        .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
        .drawWithContent {
            drawContent()
            val w = fade.toPx().coerceAtMost(size.width / 2)
            if (canScrollBack()) {
                drawRect(
                    Brush.horizontalGradient(listOf(Color.Transparent, Color.Black), startX = 0f, endX = w),
                    topLeft = Offset.Zero, size = Size(w, size.height), blendMode = BlendMode.DstIn,
                )
            }
            if (canScrollForward()) {
                drawRect(
                    Brush.horizontalGradient(listOf(Color.Black, Color.Transparent), startX = size.width - w, endX = size.width),
                    topLeft = Offset(size.width - w, 0f), size = Size(w, size.height), blendMode = BlendMode.DstIn,
                )
            }
        }

/** [horizontalEdgeFade] for a `horizontalScroll(state)` row. */
fun Modifier.horizontalEdgeFade(state: ScrollState, fade: Dp = 24.dp): Modifier =
    horizontalEdgeFade({ state.value > 0 }, { state.value < state.maxValue }, fade)

/** [horizontalEdgeFade] for a LazyRow. */
fun Modifier.horizontalEdgeFade(state: LazyListState, fade: Dp = 24.dp): Modifier =
    horizontalEdgeFade({ state.canScrollBackward }, { state.canScrollForward }, fade)
