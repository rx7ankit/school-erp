package tech.krevo.app.design

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.pow

// The orange dot art: a page-wide matrix fixed behind the top of Home, and the glass card that sits over it.
// Purely decorative; none of it takes part in layout or touches.

private val MatrixSpacing = 10.dp
private val MatrixRadius = 2.8.dp

/**
 * A grid of orange dots that is strongest at the top edge and dissolves towards the bottom. Orange at the top turns to
 * peach lower down, each dot has a thin white ring, and a very faint warm glow sits behind the top. The caller sets the height.
 */
@Composable
fun DotMatrix(modifier: Modifier = Modifier) {
    val accent = Krevo.colors.accent
    Canvas(modifier.fillMaxWidth()) {
        val spacing = MatrixSpacing.toPx()
        val radius = MatrixRadius.toPx()
        val ring = 0.8.dp.toPx()
        drawRect(Brush.radialGradient(listOf(accent.copy(alpha = 0.10f), Color.Transparent), center = Offset(size.width / 2, 0f), radius = size.height * 0.95f))
        val cols = (size.width / spacing).toInt() + 2
        val rows = (size.height / spacing).toInt() + 1
        val xInset = (size.width - (cols - 1) * spacing) / 2
        for (r in 0 until rows) {
            val y = r * spacing + spacing / 2
            val t = y / size.height                                   // 0 at the top, 1 at the bottom
            val fade = (1 - t).coerceAtLeast(0f).pow(1.6f)
            for (c in 0 until cols) {
                // Dots drop out more and more as the rows go down, so the edge dissolves instead of banding.
                if (cellHash(r, c) > fade * 1.5 + 0.06) continue
                val strength = (fade * (0.55 + 0.45 * cellHash(c, r + 91))).toFloat()
                val tone = Color(0.95f, 0.42f + 0.30f * t, 0.11f + 0.32f * t)
                val center = Offset(xInset + c * spacing, y)
                drawCircle(tone.copy(alpha = 0.16f + 0.70f * strength), radius, center)
                drawCircle(Color.White.copy(alpha = 0.45f * (0.4f + strength)), radius, center, style = Stroke(ring))
            }
        }
    }
}

/**
 * The card used for attendance: frosted glass. A translucent white fill with a thin light border and no shadow, so the
 * dot matrix fixed behind the page shows through it. As big as its content. Pass [onClick] to make the whole card tappable.
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    radius: Dp = 30.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(radius)
    val border = BorderStroke(1.dp, Color.White.copy(alpha = 0.7f))
    val body: @Composable () -> Unit = { Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content) }
    val fill = Color.White.copy(alpha = 0.58f)
    if (onClick != null) {
        Surface(onClick = onClick, modifier = modifier.fillMaxWidth(), shape = shape, color = fill, border = border, tonalElevation = 0.dp, shadowElevation = 0.dp) { body() }
    } else {
        Surface(modifier = modifier.fillMaxWidth(), shape = shape, color = fill, border = border, tonalElevation = 0.dp, shadowElevation = 0.dp) { body() }
    }
}

/** A repeatable pseudo-random number in 0 until 1 for a grid cell: the same cell always gets the same number. */
internal fun cellHash(a: Int, b: Int): Double {
    var x = (a.toLong() * 73856093L) xor (b.toLong() * 19349663L)
    x = (x xor (x ushr 15)) * 0x2C1B3C6DL
    x = (x xor (x ushr 12)) * 0x297A2D39L
    x = x xor (x ushr 15)
    return java.lang.Long.remainderUnsigned(x, 10_000L) / 10_000.0
}
