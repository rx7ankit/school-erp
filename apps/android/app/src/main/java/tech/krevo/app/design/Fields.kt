package tech.krevo.app.design

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun KrevoTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text,
    password: Boolean = false,
    singleLine: Boolean = true,
    enabled: Boolean = true,
) {
    val c = Krevo.colors
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = modifier.fillMaxWidth().heightIn(min = 56.dp),
        enabled = enabled,
        singleLine = singleLine,
        shape = RoundedCornerShape(Radius.control),
        keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboardType),
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = c.text,
            unfocusedBorderColor = c.separator,
            disabledBorderColor = c.separator,
            errorBorderColor = c.danger,
            focusedContainerColor = c.bg,
            unfocusedContainerColor = c.bg,
            disabledContainerColor = c.card,
            focusedLabelColor = c.textSecondary,
            unfocusedLabelColor = c.textSecondary,
            cursorColor = c.text,
            focusedTextColor = c.text,
            unfocusedTextColor = c.text,
            disabledTextColor = c.textTertiary,
        ),
    )
}

/** Segmented control: selected segment is solid black/white, the rest are grey. */
@Composable
fun SegmentedControl(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = Krevo.colors
    Surface(modifier = modifier.fillMaxWidth(), shape = CircleShape, color = c.card, tonalElevation = 0.dp, shadowElevation = 0.dp) {
        Row(modifier = Modifier.padding(4.dp)) {
            options.forEachIndexed { index, label ->
                val selected = index == selectedIndex
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp)
                        .selectable(selected = selected, role = Role.Tab, onClick = { onSelect(index) }),
                    shape = CircleShape,
                    color = if (selected) c.solid else c.card,
                    tonalElevation = 0.dp,
                    shadowElevation = 0.dp,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelLarge,
                            color = if (selected) c.onSolid else c.text,
                        )
                    }
                }
            }
        }
    }
}
