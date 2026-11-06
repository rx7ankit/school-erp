package tech.krevo.app.design

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// The glass card that sits over the orange top glow. Purely visual.

/**
 * The card used for attendance: frosted glass. A translucent white fill with a thin light border and no shadow, so the
 * top glow fixed behind the page shows through it. As big as its content. Pass [onClick] to make the whole card tappable.
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
