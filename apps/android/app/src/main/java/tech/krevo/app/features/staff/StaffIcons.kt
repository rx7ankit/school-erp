package tech.krevo.app.features.staff

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/** Line icons for the tabs that the core icon set has no picture for. Drawn on a 24 unit grid, 2 wide, and tinted by the tab. */
internal object StaffIcons {
    private fun line(name: String, vararg paths: String): ImageVector {
        val b = ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f)
        paths.forEach { d ->
            b.addPath(
                PathParser().parsePathString(d).toNodes(), stroke = SolidColor(Color.Black), strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
            )
        }
        return b.build()
    }

    /** A graduation cap. */
    val Academic = line("academic", "M2 9 L12 4 L22 9 L12 14 Z", "M6 11.5 V16 Q12 20 18 16 V11.5")

    /** A rupee sign. */
    val Fees = line("fees", "M6 5 H18", "M6 9.5 H18", "M6 5 H10 A4.25 4.25 0 0 1 10 13.5 H6", "M9 13.5 L16 20")

    /** Three books on a shelf. */

    /** Two people side by side. */
    val People = line("people", "M5.5 8.5 A3 3 0 1 0 11.5 8.5 A3 3 0 1 0 5.5 8.5", "M2 20 Q2 14.5 8.5 14.5 Q15 14.5 15 20", "M15 5.7 A3 3 0 0 1 15 11.3", "M17.5 14.7 Q22 15.3 22 20")

    /** A framed picture: a photo. */
    val Photo = line("photo", "M3 5 H21 V19 H3 Z", "M3 16 L9 10.5 L14 15.5 L17 12.5 L21 16.5", "M7.2 9 A1.2 1.2 0 1 0 9.6 9 A1.2 1.2 0 1 0 7.2 9")

    /** An arrow pointing up and to the right. */
    val ArrowUpRight = line("arrow_up_right", "M7 17 L17 7", "M8 7 H17 V16")

    /** A camera. */
    val Camera = line("camera", "M3 8 H7 L9 5 H15 L17 8 H21 V19 H3 Z", "M8.8 13.5 A3.2 3.2 0 1 0 15.2 13.5 A3.2 3.2 0 1 0 8.8 13.5")
}
