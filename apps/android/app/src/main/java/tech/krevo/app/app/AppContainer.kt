package tech.krevo.app.app

import android.content.Context
import tech.krevo.app.data.AppCompatLanguageStore
import tech.krevo.app.data.LanguageStore
import tech.krevo.app.data.PrefsStore
import tech.krevo.app.data.Repository

/**
 * Manual dependency container.
 * TODO: switch to ApiRepository(baseUrl) once the FastAPI backend exists.
 */
class AppContainer(context: Context) {
    val api: tech.krevo.app.data.ApiClient =
        tech.krevo.app.data.ApiClient(store = tech.krevo.app.data.EncryptedTokenStore(context.applicationContext))
    val repository: Repository = tech.krevo.app.data.ApiRepository(api)
    val prefs: PrefsStore = PrefsStore(context)
    val languageStore: LanguageStore = AppCompatLanguageStore(prefs)
}
