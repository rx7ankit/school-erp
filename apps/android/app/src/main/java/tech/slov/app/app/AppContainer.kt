package tech.slov.app.app

import android.content.Context
import tech.slov.app.data.AppCompatLanguageStore
import tech.slov.app.data.LanguageStore
import tech.slov.app.data.MockRepository
import tech.slov.app.data.PrefsStore
import tech.slov.app.data.Repository

/**
 * Manual dependency container.
 * TODO: switch to ApiRepository(baseUrl) once the FastAPI backend exists.
 */
class AppContainer(context: Context) {
    val repository: Repository = MockRepository()
    val prefs: PrefsStore = PrefsStore(context)
    val languageStore: LanguageStore = AppCompatLanguageStore(prefs)
}
