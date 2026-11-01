package `in`.scool.app.app

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

/**
 * The in-app language. AppCompat stores the choice (system LocaleManager on Android 13+, its own storage
 * below that, see the AppLocalesMetadataHolderService entry in the manifest) and recreates the activity,
 * so a change shows immediately and survives restarts. SYSTEM means "follow the device": Hindi if the
 * device is Hindi, otherwise English (res/xml/locales_config.xml lists the two supported languages).
 */
enum class AppLanguage(val tag: String?) {
    SYSTEM(null),
    ENGLISH("en"),
    HINDI("hi");

    fun apply() {
        AppCompatDelegate.setApplicationLocales(
            if (tag == null) LocaleListCompat.getEmptyLocaleList() else LocaleListCompat.forLanguageTags(tag),
        )
    }

    companion object {
        fun current(): AppLanguage {
            val locales = AppCompatDelegate.getApplicationLocales()
            if (locales.isEmpty) return SYSTEM
            return if (locales[0]?.language == "hi") HINDI else ENGLISH
        }
    }
}
