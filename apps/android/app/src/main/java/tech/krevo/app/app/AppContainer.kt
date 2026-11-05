package tech.krevo.app.app

import android.content.Context
import tech.krevo.app.data.AppCompatLanguageStore
import tech.krevo.app.data.LanguageStore
import tech.krevo.app.data.MockRepository
import tech.krevo.app.data.PrefsStore
import tech.krevo.app.data.Repository

/**
 * Manual dependency container.
 * TODO: switch to ApiRepository(baseUrl) once the FastAPI backend exists.
 */
class AppContainer(context: Context) {
    val api: tech.krevo.app.data.ApiClient = tech.krevo.app.data.ApiClient()
    val repository: Repository = MockRepository()
    val prefs: PrefsStore = PrefsStore(context)
    val languageStore: LanguageStore = AppCompatLanguageStore(prefs)
}
