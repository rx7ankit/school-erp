package `in`.scool.app.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.design.ScoolTheme
import `in`.scool.app.design.ThemeMode
import `in`.scool.app.domain.Ist

/** AppCompatActivity (a ComponentActivity) so AppCompatDelegate.setApplicationLocales can switch language live. */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // Month and weekday names follow the active app language; the channels get their localised names.
        Ist.locale = resources.configuration.locales[0]
        NotificationChannels.create(this)
        val container = (application as ScoolApplication).container
        setContent {
            val session: SessionViewModel = viewModel(
                factory = VmFactory { SessionViewModel(container.repository, container.prefs) },
            )
            val mode by session.themeMode.collectAsStateWithLifecycle()
            val dark = when (mode) {
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
            }
            SideEffect {
                // Keep status and navigation bar icons readable when the in-app theme differs from the system one.
                val controller = WindowCompat.getInsetsController(window, window.decorView)
                controller.isAppearanceLightStatusBars = !dark
                controller.isAppearanceLightNavigationBars = !dark
            }
            ScoolTheme(mode = mode) {
                ScoolApp(repository = container.repository, session = session)
            }
        }
    }
}
