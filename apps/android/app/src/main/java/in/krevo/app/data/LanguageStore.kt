package `in`.krevo.app.data

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import `in`.krevo.app.domain.AppLanguage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.util.Locale

/** Which language the app shows and whether the parent has picked one yet. */
interface LanguageStore {
    /** False until the parent taps a language once (the first launch chooser). Persisted. */
    val chosen: Flow<Boolean>

    /** The language the app is showing now. */
    fun current(): AppLanguage

    /** Remembers the choice and switches the app language at once, without restarting the app. */
    suspend fun choose(language: AppLanguage)
}

/**
 * Uses `AppCompatDelegate.setApplicationLocales`: the system stores it on Android 13+, and on older versions
 * AppCompat stores it itself (see `AppLocalesMetadataHolderService` in the manifest), so it survives process death.
 * The activity is recreated with the new resources; ViewModels and the navigation state stay.
 */
class AppCompatLanguageStore(private val prefs: PrefsStore) : LanguageStore {
    override val chosen: Flow<Boolean> = prefs.languageChosen

    override fun current(): AppLanguage {
        val locales = AppCompatDelegate.getApplicationLocales()
        val code = if (locales.isEmpty()) Locale.getDefault().language else locales.get(0)?.language
        return AppLanguage.fromCode(code)
    }

    override suspend fun choose(language: AppLanguage) {
        prefs.setLanguageChosen()
        AppLanguage.current = language
        // setApplicationLocales must run on the main thread.
        withContext(Dispatchers.Main.immediate) {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(language.code))
        }
    }
}
