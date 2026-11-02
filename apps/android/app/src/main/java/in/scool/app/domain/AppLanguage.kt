package `in`.scool.app.domain

import java.util.Locale

/**
 * The two languages of the parent app. [code] is what AppCompat, `locales_config.xml` and the backend
 * (`PATCH /parent/preferences {language}`) use; [locale] is what dates are formatted with (Latin digits, Indian grouping).
 */
enum class AppLanguage(val code: String, val locale: Locale, val nativeName: String) {
    EN("en", Locale.forLanguageTag("en-IN"), "English"),
    HI("hi", Locale.forLanguageTag("hi-IN"), "हिन्दी");

    companion object {
        /**
         * The language the screen is showing right now. Set in `MainActivity.onCreate` on every (re)creation, which
         * is also what happens after a language switch, so every formatter reads a value that matches the resources.
         */
        @Volatile
        var current: AppLanguage = EN

        fun fromCode(code: String?): AppLanguage = entries.firstOrNull { it.code == code } ?: EN
    }
}
