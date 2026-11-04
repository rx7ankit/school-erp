package tech.krevo.app.design

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** Colour tokens from packages/tokens/tokens.json. */
@Immutable
data class KrevoColors(
    val bg: Color,
    val card: Color,
    val fill: Color,
    val text: Color,
    val textSecondary: Color,
    val textTertiary: Color,
    val separator: Color,
    val accent: Color,
    val accentSubtle: Color,
    val onAccent: Color,
    val solid: Color,
    val onSolid: Color,
    val success: Color,
    val warning: Color,
    val danger: Color,
)

val LightKrevoColors = KrevoColors(
    bg = Color(0xFFFFFFFF),
    card = Color(0xFFF5F5F7),
    fill = Color(0xFFE8E8ED),
    text = Color(0xFF1D1D1F),
    textSecondary = Color(0xFF6E6E73),
    textTertiary = Color(0xFF86868B),
    separator = Color(0xFFD2D2D7),
    accent = Color(0xFFF26A1B),
    accentSubtle = Color(0xFFFFF0E6),
    onAccent = Color(0xFFFFFFFF),
    solid = Color(0xFF000000),
    onSolid = Color(0xFFFFFFFF),
    success = Color(0xFF1E8E3E),
    warning = Color(0xFFB25E00),
    danger = Color(0xFFD70015),
)

val LocalKrevoColors = staticCompositionLocalOf { LightKrevoColors }
