package tech.krevo.app.data.staff

import org.json.JSONObject
import tech.krevo.app.data.arr
import tech.krevo.app.data.int
import tech.krevo.app.data.mapObjects
import tech.krevo.app.data.str
import tech.krevo.app.data.strings

// Models for People & access. Parsed with the null-safe helpers in ApiClient.kt.

data class PermissionInfo(val key: String, val label: String, val description: String)
data class AccessPreset(val key: String, val label: String, val permissions: List<String>)

/** `GET /staff/access-options`: the four permissions in plain words, and the one-tap presets. */
data class AccessOptions(val permissions: List<PermissionInfo>, val presets: List<AccessPreset>) {
    companion object {
        fun from(j: JSONObject) = AccessOptions(
            j.arr("permissions").mapObjects { PermissionInfo(it.getString("key"), it.str("label").orEmpty(), it.str("description").orEmpty()) },
            j.arr("presets").mapObjects { AccessPreset(it.getString("key"), it.str("label").orEmpty(), it.strings("permissions")) },
        )
    }
}
