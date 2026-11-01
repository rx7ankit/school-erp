package `in`.scool.app.design

import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

enum class ButtonKind { SOLID, BRAND, QUIET }

/** Pill button. SOLID = black/white, BRAND = orange (the primary action), QUIET = grey fill. */
@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.SOLID,
    enabled: Boolean = true,
) {
    val c = Scool.colors
    val (container, content) = when (kind) {
        ButtonKind.SOLID -> c.solid to c.onSolid
        ButtonKind.BRAND -> c.accent to c.onAccent
        ButtonKind.QUIET -> c.fill to c.text
    }
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.heightIn(min = 52.dp),
        shape = CircleShape,
        elevation = null,
        colors = ButtonDefaults.buttonColors(
            containerColor = container,
            contentColor = content,
            disabledContainerColor = c.fill,
            disabledContentColor = c.textTertiary,
        ),
    ) {
        Text(text = text, style = androidx.compose.material3.MaterialTheme.typography.labelLarge)
    }
}
