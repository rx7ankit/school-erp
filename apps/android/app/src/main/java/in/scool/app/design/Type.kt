package `in`.scool.app.design

import android.content.Context
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * Plus Jakarta Sans is looked up by resource name so the app builds and runs with or without the TTFs.
 * Drop these files into app/src/main/res/font/ to enable it (see README):
 * plus_jakarta_sans_regular.ttf, _medium.ttf, _semibold.ttf, _bold.ttf. Otherwise FontFamily.Default is used.
 */
private val fontFiles = listOf(
    "plus_jakarta_sans_regular" to FontWeight.Normal,
    "plus_jakarta_sans_medium" to FontWeight.Medium,
    "plus_jakarta_sans_semibold" to FontWeight.SemiBold,
    "plus_jakarta_sans_bold" to FontWeight.Bold,
)

private fun loadFontFamily(context: Context): FontFamily {
    val fonts = fontFiles.mapNotNull { (name, weight) ->
        val id = context.resources.getIdentifier(name, "font", context.packageName)
        if (id == 0) null else Font(id, weight)
    }
    return if (fonts.isEmpty()) FontFamily.Default else FontFamily(fonts)
}

@Composable
fun rememberScoolFontFamily(): FontFamily {
    val context = LocalContext.current
    return remember(context) { loadFontFamily(context) }
}

/** Sizes, line heights and tracking follow the text tokens. sp values scale with the user's font size. */
fun scoolTypography(family: FontFamily): Typography {
    fun style(size: Int, line: Int, weight: FontWeight, tracking: Double) = TextStyle(
        fontFamily = family,
        fontSize = size.sp,
        lineHeight = line.sp,
        fontWeight = weight,
        letterSpacing = tracking.em,
    )
    val title1 = style(40, 44, FontWeight.Bold, -0.025)
    val title2 = style(28, 34, FontWeight.Bold, -0.02)
    val title3 = style(20, 26, FontWeight.Bold, -0.01)
    val body = style(17, 25, FontWeight.Normal, -0.01)
    val callout = style(15, 21, FontWeight.Normal, -0.005)
    val caption = style(13, 18, FontWeight.Normal, 0.0)
    return Typography(
        displayLarge = style(56, 60, FontWeight.Bold, -0.03),
        displayMedium = title1,
        displaySmall = title2,
        headlineLarge = title1,
        headlineMedium = title2,
        headlineSmall = title3,
        titleLarge = title3,
        titleMedium = body.copy(fontWeight = FontWeight.SemiBold),
        titleSmall = callout.copy(fontWeight = FontWeight.SemiBold),
        bodyLarge = body,
        bodyMedium = callout,
        bodySmall = caption,
        labelLarge = callout.copy(fontWeight = FontWeight.Medium),
        labelMedium = caption.copy(fontWeight = FontWeight.Medium),
        labelSmall = caption,
    )
}
