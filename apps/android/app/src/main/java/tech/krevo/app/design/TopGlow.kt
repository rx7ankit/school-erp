package tech.krevo.app.design

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// An orange glow that pours down from the very top edge of the screen (behind the status bar) and fades to nothing,
// with a warmer pool in the top-right corner. Decorative only: it takes no taps and no part in layout.

/** The slim band behind every page of the signed-in apps. */
val GlowSlim = 120.dp

/** The tall glow of the login screen and the launch splash. */
val GlowTall = 380.dp

/**
 * The glow, drawn from the top of its parent at a fixed [height]. Put it first in a full-screen Box so the page
 * content scrolls over it, and keep the pages' own backgrounds transparent so it shows through.
 */
@Composable
fun TopGlow(modifier: Modifier = Modifier, height: Dp = GlowSlim) {
    val accent = Krevo.colors.accent
    Canvas(modifier.fillMaxWidth().height(height)) {
        drawRect(
            Brush.verticalGradient(
                0f to accent.copy(alpha = 0.62f), 0.34f to accent.copy(alpha = 0.30f), 0.70f to accent.copy(alpha = 0.10f), 1f to Color.Transparent,
            ),
        )
        drawRect(
            Brush.radialGradient(
                listOf(Color(255, 168, 87).copy(alpha = 0.55f), Color.Transparent),
                center = Offset(size.width, 0f), radius = size.height * 0.95f,
            ),
        )
    }
}
