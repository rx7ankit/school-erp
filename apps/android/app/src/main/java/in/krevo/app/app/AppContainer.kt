package `in`.krevo.app.app

import android.content.Context
import `in`.krevo.app.data.AppCompatLanguageStore
import `in`.krevo.app.data.LanguageStore
import `in`.krevo.app.data.MockRepository
import `in`.krevo.app.data.PrefsStore
import `in`.krevo.app.data.Repository

/**
 * Manual dependency container.
 * TODO: switch to ApiRepository(baseUrl) once the FastAPI backend exists.
 */
class AppContainer(context: Context) {
    val repository: Repository = MockRepository()
    val prefs: PrefsStore = PrefsStore(context)
    val languageStore: LanguageStore = AppCompatLanguageStore(prefs)
}
