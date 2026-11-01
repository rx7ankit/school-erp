package `in`.scool.app.design

import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

enum class ButtonKind { SOLID, BRAND, QUIET }

/** Pill button ([loading] shows a spinner and disables it). SOLID = black/white, BRAND = orange (the primary action), QUIET = grey fill. */
@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: ButtonKind = ButtonKind.SOLID,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val c = Scool.colors
    val (container, content) = when (kind) {
        ButtonKind.SOLID -> c.solid to c.onSolid
        ButtonKind.BRAND -> c.accent to c.onAccent
        ButtonKind.QUIET -> c.fill to c.text
    }
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
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
        if (loading) {
            CircularProgressIndicator(
                color = c.textTertiary,
                strokeWidth = 2.dp,
                modifier = Modifier.size(22.dp).semantics { contentDescription = "Sending" },
            )
        } else {
            Text(text = text, style = androidx.compose.material3.MaterialTheme.typography.labelLarge)
        }
    }
}
