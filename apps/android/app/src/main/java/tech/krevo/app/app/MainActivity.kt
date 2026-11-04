package tech.krevo.app.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import tech.krevo.app.design.KrevoTheme
import tech.krevo.app.domain.AppLanguage

/** AppCompatActivity (not ComponentActivity) so AppCompatDelegate.setApplicationLocales also works before Android 13. */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        NotificationChannels.create(this)
        val container = (application as KrevoApplication).container
        // Dates and rupees follow the language the resources are showing; this runs again after a language switch.
        AppLanguage.current = container.languageStore.current()
        setContent {
            val session: SessionViewModel = viewModel(
                factory = VmFactory { SessionViewModel(container.repository, container.prefs, container.languageStore) },
            )
            SideEffect {
                // The app is always light, so status and navigation bar icons are dark.
                val controller = WindowCompat.getInsetsController(window, window.decorView)
                controller.isAppearanceLightStatusBars = true
                controller.isAppearanceLightNavigationBars = true
            }
            KrevoTheme {
                KrevoApp(repository = container.repository, session = session)
            }
        }
    }
}
