package `in`.scool.app.features.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import `in`.scool.app.BuildConfig
import `in`.scool.app.design.ButtonKind
import `in`.scool.app.design.PillButton
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.SectionLabel
import `in`.scool.app.design.SegmentedControl
import `in`.scool.app.design.ThemeMode

@Composable
fun SettingsScreen(
    mode: ThemeMode,
    onModeChange: (ThemeMode) -> Unit,
    onChangePassword: () -> Unit,
    onSignOut: () -> Unit,
    onBack: () -> Unit,
) {
    val modes = ThemeMode.entries
    ScoolList {
        item { ScreenHeader(ink = "Settings.", grey = "Make it yours.", onBack = onBack) }
        item {
            ScoolCard {
                SectionLabel("Appearance")
                SegmentedControl(
                    options = modes.map { it.label },
                    selectedIndex = modes.indexOf(mode),
                    onSelect = { onModeChange(modes[it]) },
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
        item {
            ScoolCard(onClick = onChangePassword) {
                Row(
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Change password", style = MaterialTheme.typography.titleMedium, color = Scool.colors.text)
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Scool.colors.textTertiary)
                }
            }
        }
        item { PillButton(text = "Sign out", onClick = onSignOut, kind = ButtonKind.SOLID, modifier = Modifier.fillMaxWidth()) }
        item {
            Text(
                "Scool ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                style = MaterialTheme.typography.bodySmall,
                color = Scool.colors.textTertiary,
            )
        }
    }
}
