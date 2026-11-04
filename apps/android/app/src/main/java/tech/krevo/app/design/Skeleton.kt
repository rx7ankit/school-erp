package tech.krevo.app.design

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified
import kotlinx.coroutines.delay
import tech.krevo.app.R

/** False when the user turned system animations off (animator duration scale 0): skeletons stay still, content just appears. */
@Composable
fun rememberAnimationsEnabled(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember(resolver) {
        try {
            Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) != 0f
        } catch (e: Exception) {
            true
        }
    }
}

/**
 * Flat skeleton fill (the theme's fill colour) with a slow, soft highlight moving left to right.
 * Still when animations are disabled. No shadow, no elevation.
 */
fun Modifier.shimmer(shape: Shape = RectangleShape): Modifier = composed {
    val c = Krevo.colors
    val fill = c.fill
    val highlight = c.card
    val enabled = rememberAnimationsEnabled()
    val progress: State<Float> = if (enabled) {
        rememberInfiniteTransition(label = "shimmer").animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(durationMillis = 1600, easing = LinearEasing), RepeatMode.Restart),
            label = "shimmerProgress",
        )
    } else {
        remember { mutableStateOf(0f) }
    }
    this
        .clip(shape)
        .drawBehind {
            drawRect(fill)
            if (enabled) {
                val band = size.width * 0.6f
                val start = -band + (size.width + band) * progress.value
                drawRect(
                    brush = Brush.horizontalGradient(
                        colors = listOf(fill, highlight, fill),
                        startX = start,
                        endX = start + band,
                    ),
                    topLeft = Offset.Zero,
                )
            }
        }
}

/** Dp line height of a text style, so a skeleton line takes exactly the room the real text will. */
@Composable
private fun TextStyle.lineHeightDp(): Dp {
    val density = LocalDensity.current
    return with(density) { lineHeight.toDp() }
}

/** A plain shimmering block. Width fills the parent when [width] is not given. */
@Composable
fun SkeletonBox(
    modifier: Modifier = Modifier,
    width: Dp = Dp.Unspecified,
    height: Dp = 16.dp,
    shape: Shape = RoundedCornerShape(8.dp),
) {
    val size = if (width.isSpecified) Modifier.width(width) else Modifier.fillMaxWidth()
    Box(modifier = modifier.then(size).height(height).shimmer(shape))
}

/** Round placeholder (avatar, icon). */
@Composable
fun SkeletonCircle(size: Dp, modifier: Modifier = Modifier) {
    SkeletonBox(modifier = modifier, width = size, height = size, shape = CircleShape)
}

/** Pill placeholder (chip, badge). */
@Composable
fun SkeletonPill(modifier: Modifier = Modifier, width: Dp = 64.dp, height: Dp = 26.dp) {
    SkeletonBox(modifier = modifier, width = width, height = height, shape = CircleShape)
}

/**
 * One line of text. It occupies the full line height of [style] (so the layout does not move when the real text
 * arrives) and draws a slim bar inside it.
 */
@Composable
fun SkeletonLine(
    modifier: Modifier = Modifier,
    width: Dp = Dp.Unspecified,
    fraction: Float = 1f,
    style: TextStyle = MaterialTheme.typography.bodyMedium,
) {
    val line = style.lineHeightDp()
    val sizing = if (width.isSpecified) Modifier.width(width) else Modifier.fillMaxWidth(fraction)
    Box(modifier = modifier.then(sizing).height(line), contentAlignment = Alignment.CenterStart) {
        Box(modifier = Modifier.fillMaxWidth().height(line * 0.62f).shimmer(CircleShape))
    }
}

/** Avatar, two lines and a trailing pill. */
@Composable
fun SkeletonRow(modifier: Modifier = Modifier, avatarSize: Dp = 40.dp, showPill: Boolean = true) {
    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        SkeletonCircle(avatarSize)
        Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
            SkeletonLine(fraction = 0.55f, style = MaterialTheme.typography.titleMedium)
            SkeletonLine(fraction = 0.85f, style = MaterialTheme.typography.bodyMedium)
        }
        if (showPill) SkeletonPill()
    }
}

/** A flat grey card (same shape and padding as [KrevoCard]) holding placeholders. Default: label, value, caption. */
@Composable
fun SkeletonCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit = {
        SkeletonLine(width = 90.dp, style = MaterialTheme.typography.labelMedium)
        SkeletonLine(modifier = Modifier.padding(top = 4.dp), width = 170.dp, style = MaterialTheme.typography.headlineSmall)
        SkeletonLine(width = 120.dp, style = MaterialTheme.typography.bodyMedium)
    },
) {
    KrevoCard(modifier = modifier, content = content)
}

/** Grid of small stat cards (label + big number), [columns] across and [rows] down. */
@Composable
fun SkeletonStatGrid(modifier: Modifier = Modifier, rows: Int = 2, columns: Int = 2) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(rows) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                repeat(columns) {
                    SkeletonCard(modifier = Modifier.weight(1f)) {
                        SkeletonLine(width = 70.dp, style = MaterialTheme.typography.bodySmall)
                        SkeletonLine(width = 56.dp, style = MaterialTheme.typography.headlineMedium)
                    }
                }
            }
        }
    }
}

/** Generic list: [rows] cards, each with an avatar row. */
@Composable
fun SkeletonList(modifier: Modifier = Modifier, rows: Int = 4) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(rows) { SkeletonCard { SkeletonRow() } }
    }
}

/**
 * Container for a whole skeleton: spaced like [KrevoList] and announced by TalkBack as a single "Loading"
 * (the placeholders inside are hidden from accessibility).
 */
@Composable
fun SkeletonHost(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val loadingText = stringResource(R.string.loading)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clearAndSetSemantics { contentDescription = loadingText },
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

/**
 * Soft entrance: fades in (0 to 1) and slides up 10dp over ~450ms with a small stagger by [index].
 * Plays once per item (remembered across scrolling and recreation); skipped when system animations are off.
 */
fun Modifier.appear(index: Int = 0): Modifier = composed {
    val enabled = rememberAnimationsEnabled()
    var shown by rememberSaveable { mutableStateOf(false) }
    val progress = remember { Animatable(if (shown || !enabled) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!shown && enabled) {
            val stagger = minOf(index, 8) * 40
            if (stagger > 0) delay(stagger.toLong())
            progress.animateTo(1f, tween(durationMillis = 450, easing = FastOutSlowInEasing))
        }
        shown = true
    }
    val offsetPx = with(LocalDensity.current) { 10.dp.toPx() }
    this.graphicsLayer {
        val p = progress.value
        alpha = p
        translationY = (1f - p) * offsetPx
    }
}

/**
 * True while composing the content of a freshly loaded list item: shared containers (cards, headers, labels)
 * then reveal their INNER content with [appear] while their shape and background stay still.
 * Containers reset it to false for their own children so nothing animates twice.
 */
val LocalRevealContent = compositionLocalOf { false }

/** Running position of the current list item, used as the stagger index of the reveal. */
val LocalRevealIndex = compositionLocalOf { 0 }

/** Applies [appear] when [LocalRevealContent] is true (staggered by [LocalRevealIndex]); otherwise does nothing. */
@Composable
fun Modifier.revealed(): Modifier {
    val on = LocalRevealContent.current
    val index = LocalRevealIndex.current
    return if (on) this.appear(index) else this
}

/** Wraps [content] in the [appear] entrance. */
@Composable
fun Appear(modifier: Modifier = Modifier, index: Int = 0, content: @Composable () -> Unit) {
    Box(modifier = modifier.appear(index)) { content() }
}
