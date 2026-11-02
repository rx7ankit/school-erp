package `in`.scool.app.app

import android.content.Context
import `in`.scool.app.data.AppCompatLanguageStore
import `in`.scool.app.data.LanguageStore
import `in`.scool.app.data.MockRepository
import `in`.scool.app.data.PrefsStore
import `in`.scool.app.data.Repository

/**
 * Manual dependency container.
 * TODO: switch to ApiRepository(baseUrl) once the FastAPI backend exists.
 */
class AppContainer(context: Context) {
    val repository: Repository = MockRepository()
    val prefs: PrefsStore = PrefsStore(context)
    val languageStore: LanguageStore = AppCompatLanguageStore(prefs)
}
