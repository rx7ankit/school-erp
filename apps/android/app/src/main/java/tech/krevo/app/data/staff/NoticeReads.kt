package tech.krevo.app.data.staff

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** Which notices this person has opened on this phone. A notice is "New" until it is opened once. Kept per person. */
class NoticeReads(context: Context, userId: String) {
    private val prefs = context.applicationContext.getSharedPreferences("krevo.noticeReads", Context.MODE_PRIVATE)
    private val key = "ids.$userId"
    private var ids by mutableStateOf(prefs.getString(key, null)?.split(',')?.filter { it.isNotEmpty() } ?: emptyList())

    fun isNew(id: String): Boolean = id !in ids

    fun markRead(id: String) {
        if (id in ids) return
        ids = (ids + id).takeLast(500)
        prefs.edit().putString(key, ids.joinToString(",")).apply()
    }
}
