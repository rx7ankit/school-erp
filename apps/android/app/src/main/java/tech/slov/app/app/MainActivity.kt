package tech.slov.app.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import tech.slov.app.design.SlovTheme
import tech.slov.app.design.ThemeMode
import tech.slov.app.domain.AppLanguage

/** AppCompatActivity (not ComponentActivity) so AppCompatDelegate.setApplicationLocales also works before Android 13. */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        NotificationChannels.create(this)
        val container = (application as SlovApplication).container
        // Dates and rupees follow the language the resources are showing; this runs again after a language switch.
        AppLanguage.current = container.languageStore.current()
        setContent {
            val session: SessionViewModel = viewModel(
                factory = VmFactory { SessionViewModel(container.repository, container.prefs, container.languageStore) },
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
            SlovTheme(mode = mode) {
                SlovApp(repository = container.repository, session = session)
            }
        }
    }
}
