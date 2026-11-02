package tech.slov.app.design

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import tech.slov.app.R

enum class ThemeMode(val labelRes: Int) {
    SYSTEM(R.string.theme_system), LIGHT(R.string.theme_light), DARK(R.string.theme_dark),
}

/** Radius tokens: card 20, control 12, pill = full. */
object Radius {
    val card = 20.dp
    val control = 12.dp
}

/** Access to the extra tokens that Material's ColorScheme has no slot for. */
object Slov {
    val colors: SlovColors
        @Composable get() = LocalSlovColors.current
}

private fun SlovColors.toM3(dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = solid,
        onPrimary = onSolid,
        primaryContainer = fill,
        onPrimaryContainer = text,
        secondary = fill,
        onSecondary = text,
        secondaryContainer = fill,
        onSecondaryContainer = text,
        tertiary = accent,
        onTertiary = onAccent,
        background = bg,
        onBackground = text,
        surface = bg,
        onSurface = text,
        surfaceVariant = card,
        onSurfaceVariant = textSecondary,
        surfaceTint = bg,
        surfaceBright = bg,
        surfaceDim = bg,
        surfaceContainerLowest = bg,
        surfaceContainerLow = card,
        surfaceContainer = card,
        surfaceContainerHigh = card,
        surfaceContainerHighest = fill,
        outline = textTertiary,
        outlineVariant = separator,
        error = danger,
        onError = onSolid,
        scrim = solid,
    )
}

@Composable
fun SlovTheme(mode: ThemeMode = ThemeMode.SYSTEM, content: @Composable () -> Unit) {
    val dark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val colors = if (dark) DarkSlovColors else LightSlovColors
    // Hindi needs taller line heights and no negative tracking (see slovTypography).
    val hindi = LocalConfiguration.current.locales.get(0)?.language == "hi"
    val fontFamily = rememberSlovFontFamily()
    // No dynamic colour. Elevation is always 0: components use flat fills, never shadows.
    CompositionLocalProvider(LocalSlovColors provides colors) {
        MaterialTheme(
            colorScheme = colors.toM3(dark),
            typography = remember(fontFamily, hindi) { slovTypography(fontFamily, devanagari = hindi) },
            shapes = Shapes(
                extraSmall = RoundedCornerShape(8.dp),
                small = RoundedCornerShape(Radius.control),
                medium = RoundedCornerShape(Radius.control),
                large = RoundedCornerShape(Radius.card),
                extraLarge = RoundedCornerShape(28.dp),
            ),
            content = content,
        )
    }
}
