package `in`.scool.app.features.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import `in`.scool.app.BuildConfig
import `in`.scool.app.R
import `in`.scool.app.app.AppLanguage
import `in`.scool.app.design.ButtonKind
import `in`.scool.app.design.PillButton
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.SectionLabel
import `in`.scool.app.design.SegmentedControl
import `in`.scool.app.design.ThemeMode
import `in`.scool.app.domain.NotificationCategory

private fun labelFor(c: NotificationCategory): Int = when (c) {
    NotificationCategory.ATTENDANCE -> R.string.notify_attendance
    NotificationCategory.FEES -> R.string.notify_fees
    NotificationCategory.NOTICES_EXAMS -> R.string.notify_notices_exams
    NotificationCategory.RESULTS -> R.string.notify_results
    NotificationCategory.MESSAGES -> R.string.notify_messages
}

@Composable
fun SettingsScreen(
    mode: ThemeMode,
    onModeChange: (ThemeMode) -> Unit,
    language: AppLanguage,
    onLanguageChange: (AppLanguage) -> Unit,
    notifications: Map<NotificationCategory, Boolean>,
    onNotificationChange: (NotificationCategory, Boolean) -> Unit,
    onChangePassword: () -> Unit,
    onSignOut: () -> Unit,
    onBack: () -> Unit,
) {
    val modes = ThemeMode.entries
    val languages = AppLanguage.entries
    ScoolList {
        item { ScreenHeader(ink = stringResource(R.string.settings_title_ink), grey = stringResource(R.string.settings_title_grey), onBack = onBack) }
        item {
            ScoolCard {
                SectionLabel(stringResource(R.string.settings_appearance))
                SegmentedControl(
                    options = modes.map { stringResource(it.labelRes) },
                    selectedIndex = modes.indexOf(mode),
                    onSelect = { onModeChange(modes[it]) },
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
        item {
            ScoolCard {
                SectionLabel(stringResource(R.string.settings_language))
                SegmentedControl(
                    options = languages.map {
                        stringResource(
                            when (it) {
                                AppLanguage.SYSTEM -> R.string.language_system
                                AppLanguage.ENGLISH -> R.string.language_english
                                AppLanguage.HINDI -> R.string.language_hindi
                            },
                        )
                    },
                    selectedIndex = languages.indexOf(language),
                    onSelect = { onLanguageChange(languages[it]) },
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
        item {
            ScoolCard {
                SectionLabel(stringResource(R.string.settings_notifications))
                NotificationCategory.entries.forEach { category ->
                    SwitchRow(
                        label = stringResource(labelFor(category)),
                        checked = notifications[category] ?: true,
                        onChange = { onNotificationChange(category, it) },
                    )
                }
            }
        }
        item {
            ScoolCard(onClick = onChangePassword) {
                Row(
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(stringResource(R.string.settings_change_password), style = MaterialTheme.typography.titleMedium, color = Scool.colors.text)
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Scool.colors.textTertiary)
                }
            }
        }
        item { PillButton(text = stringResource(R.string.sign_out), onClick = onSignOut, kind = ButtonKind.SOLID, modifier = Modifier.fillMaxWidth()) }
        item {
            Text(
                stringResource(R.string.settings_version, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE),
                style = MaterialTheme.typography.bodySmall,
                color = Scool.colors.textTertiary,
            )
        }
    }
}

/** Whole row toggles; the switch itself is flat black/white, never orange. */
@Composable
private fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    val c = Scool.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .toggleable(value = checked, role = Role.Switch, onValueChange = onChange),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge, color = c.text, modifier = Modifier.weight(1f))
        Switch(
            checked = checked,
            onCheckedChange = null,
            colors = SwitchDefaults.colors(
                checkedThumbColor = c.onSolid,
                checkedTrackColor = c.solid,
                checkedBorderColor = Color.Transparent,
                uncheckedThumbColor = c.textTertiary,
                uncheckedTrackColor = c.fill,
                uncheckedBorderColor = c.separator,
            ),
        )
    }
}
