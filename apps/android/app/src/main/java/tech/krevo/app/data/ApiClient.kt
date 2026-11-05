package tech.krevo.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import tech.krevo.app.BuildConfig

/** A failure the screens can show as is. */
class ApiException(message: String) : Exception(message)

/**
 * Thin client for the Krevo API, shared by the parent and the staff side. Plain HttpURLConnection and org.json (no extra
 * libraries). Sends the bearer token, refreshes it once on a 401, and turns the API's `{"error": {"message": ...}}`
 * body into a readable message. Nothing here knows about screens.
 */
class ApiClient(private val baseUrl: String = BuildConfig.API_BASE) {
    @Volatile private var access = ""
    @Volatile private var refresh = ""

    val hasSession: Boolean get() = access.isNotEmpty()

    /** Result of a sign in. */
    data class Token(val access: String, val refresh: String, val kind: String, val mustChangePassword: Boolean)

    suspend fun login(email: String, password: String): Token {
        val body = JSONObject().put("email", email).put("password", password).put("device", "android")
        val json = request("POST", "/auth/login", body = body, authorised = false) as JSONObject
        access = json.getString("access_token")
        refresh = json.getString("refresh_token")
        return Token(access, refresh, json.getString("kind"), json.optBoolean("must_change_password"))
    }

    /** Ends the session on the server (best effort) and forgets the tokens on this phone. */
    suspend fun signOut() {
        val had = access.isNotEmpty()
        try { if (had) request("POST", "/auth/logout") } catch (_: Exception) { }
        access = ""
        refresh = ""
    }

    suspend fun getObject(path: String, query: Map<String, String?> = emptyMap()): JSONObject =
        request("GET", path, query) as JSONObject

    suspend fun getArray(path: String, query: Map<String, String?> = emptyMap()): JSONArray =
        request("GET", path, query) as JSONArray

    suspend fun send(method: String, path: String, body: JSONObject? = null, query: Map<String, String?> = emptyMap()): Any? =
        request(method, path, query, body)

    private suspend fun renew(): Boolean {
        val current = refresh
        if (current.isEmpty()) return false
        return try {
            val json = request("POST", "/auth/refresh", body = JSONObject().put("refresh_token", current), authorised = false) as JSONObject
            access = json.getString("access_token")
            refresh = json.getString("refresh_token")
            true
        } catch (_: Exception) { false }
    }

    private suspend fun request(
        method: String, path: String, query: Map<String, String?> = emptyMap(), body: JSONObject? = null,
        authorised: Boolean = true, retried: Boolean = false,
    ): Any? {
        val result = withContext(Dispatchers.IO) { call(method, path, query, body, authorised) }
        if (result.status == 401 && authorised && !retried && renew()) return request(method, path, query, body, authorised, retried = true)
        if (result.status !in 200..299) throw ApiException(messageFrom(result.text, result.status))
        val text = result.text.trim()
        return when {
            text.isEmpty() -> JSONObject()
            text.startsWith("[") -> JSONArray(text)
            else -> JSONObject(text)
        }
    }

    private class Raw(val status: Int, val text: String)

    private fun call(method: String, path: String, query: Map<String, String?>, body: JSONObject?, authorised: Boolean): Raw {
        val q = query.filterValues { it != null }.entries.sortedBy { it.key }
            .joinToString("&") { "${it.key}=${URLEncoder.encode(it.value!!, "UTF-8")}" }
        val url = URL(baseUrl.trimEnd('/') + path + if (q.isNotEmpty()) "?$q" else "")
        val conn = url.openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = 15_000
            conn.readTimeout = 25_000
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("User-Agent", "krevo-android")
            if (authorised) conn.setRequestProperty("Authorization", "Bearer $access")
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            return Raw(status, stream?.bufferedReader()?.use { it.readText() } ?: "")
        } catch (e: java.io.IOException) {
            throw ApiException("Can't reach the school server. Check your internet connection.")
        } finally {
            conn.disconnect()
        }
    }

    private fun messageFrom(text: String, status: Int): String {
        val message = try { JSONObject(text).optJSONObject("error")?.optString("message").orEmpty() } catch (_: Exception) { "" }
        if (message.isNotBlank()) return message
        return when (status) {
            401 -> "Your session has ended. Please sign in again."
            403 -> "You don't have access to this."
            404 -> "Not found."
            else -> "Something went wrong ($status). Please try again."
        }
    }
}

/** Optional string: missing or JSON null gives null. */
fun JSONObject.str(key: String): String? = if (isNull(key)) null else optString(key).takeIf { it.isNotEmpty() || has(key) }
fun JSONObject.int(key: String, default: Int = 0): Int = if (isNull(key)) default else optInt(key, default)
fun JSONObject.dbl(key: String): Double? = if (isNull(key)) null else optDouble(key)
fun JSONObject.obj(key: String): JSONObject? = optJSONObject(key)
fun JSONObject.arr(key: String): JSONArray = optJSONArray(key) ?: JSONArray()
inline fun <T> JSONArray.mapObjects(block: (JSONObject) -> T): List<T> = (0 until length()).map { block(getJSONObject(it)) }
