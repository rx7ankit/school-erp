package `in`.scool.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import `in`.scool.app.design.ThemeMode
import `in`.scool.app.domain.NotificationCategory
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.scoolDataStore: DataStore<Preferences> by preferencesDataStore(name = "scool_prefs")

/** Small persisted settings: selected child, appearance and notification switches. */
class PrefsStore(context: Context) {
    private val store = context.applicationContext.scoolDataStore
    private val childKey = stringPreferencesKey("selected_child_id")
    private val themeKey = stringPreferencesKey("theme_mode")

    val selectedChildId: Flow<String?> = store.data.map { it[childKey] }

    val themeMode: Flow<ThemeMode> = store.data.map { prefs ->
        ThemeMode.entries.firstOrNull { it.name == prefs[themeKey] } ?: ThemeMode.SYSTEM
    }

    suspend fun setSelectedChild(id: String) {
        store.edit { it[childKey] = id }
    }

    suspend fun setThemeMode(mode: ThemeMode) {
        store.edit { it[themeKey] = mode.name }
    }

    private fun notificationKey(c: NotificationCategory) = booleanPreferencesKey("notify_${c.name.lowercase()}")

    /** Every category is on until the parent switches it off. */
    val notificationSettings: Flow<Map<NotificationCategory, Boolean>> = store.data.map { prefs ->
        NotificationCategory.entries.associateWith { prefs[notificationKey(it)] ?: true }
    }

    suspend fun setNotificationEnabled(category: NotificationCategory, enabled: Boolean) {
        store.edit { it[notificationKey(category)] = enabled }
    }
}
