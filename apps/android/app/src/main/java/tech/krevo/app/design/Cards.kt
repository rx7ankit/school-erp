package tech.krevo.app.design

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Flat grey card, radius 20, no shadow. Clickable when [onClick] is given. */
@Composable
fun KrevoCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(Radius.card)
    val color = Krevo.colors.card
    if (onClick == null) {
        Surface(modifier = modifier.fillMaxWidth(), shape = shape, color = color, tonalElevation = 0.dp, shadowElevation = 0.dp) {
            Column(modifier = Modifier.padding(contentPadding), content = content)
        }
    } else {
        Surface(
            onClick = onClick,
            modifier = modifier.fillMaxWidth(),
            shape = shape,
            color = color,
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
        ) {
            Column(modifier = Modifier.padding(contentPadding), content = content)
        }
    }
}

/** Small pill label (subject, kind). */
@Composable
fun Chip(text: String, modifier: Modifier = Modifier, background: Color = Krevo.colors.fill, content: Color = Krevo.colors.text) {
    Surface(modifier = modifier, shape = CircleShape, color = background, tonalElevation = 0.dp, shadowElevation = 0.dp) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = content,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

/** Status text on a tinted pill. Never colour alone: the word carries the meaning. */
@Composable
fun StatusBadge(text: String, color: Color, modifier: Modifier = Modifier) {
    Chip(text = text, modifier = modifier, background = color.copy(alpha = 0.14f), content = color)
}

/** Round initials avatar. Decorative: the name is always next to it. */
@Composable
fun Avatar(initials: String, size: Dp = 40.dp, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(size)
            .clearAndSetSemantics { },
        contentAlignment = Alignment.Center,
    ) {
        Surface(shape = CircleShape, color = Krevo.colors.fill, modifier = Modifier.size(size), tonalElevation = 0.dp, shadowElevation = 0.dp) {
            Box(contentAlignment = Alignment.Center) {
                Text(text = initials, style = MaterialTheme.typography.labelLarge, color = Krevo.colors.text)
            }
        }
    }
}
