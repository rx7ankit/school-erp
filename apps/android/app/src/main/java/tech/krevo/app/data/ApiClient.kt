package tech.krevo.app.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import tech.krevo.app.BuildConfig

/** A failure the screens can show as is. */
class ApiException(message: String, val code: String? = null) : Exception(message)

/**
 * Thin client for the Krevo API, shared by the parent and the staff side. Plain HttpURLConnection and org.json (no extra
 * libraries). Sends the bearer token, refreshes it once on a 401, and turns the API's `{"error": {"message": ...}}`
 * body into a readable message. Nothing here knows about screens.
 */
class ApiClient(
    private val baseUrl: String = BuildConfig.API_BASE,
    private val store: TokenStore = InMemoryTokenStore(),
    /** Replaces the network (tests). */
    private val transport: Transport? = null,
) {
    /** One HTTP exchange; [bearer] is null for calls that carry no token. */
    fun interface Transport { suspend fun send(method: String, path: String, body: JSONObject?, bearer: String?): Raw }

    class Raw(val status: Int, val text: String)

    @Volatile private var access = ""
    @Volatile private var refresh = ""

    /** The one refresh in flight: callers that hit an expired token wait here and share its result. */
    private val refreshLock = Mutex()

    /** Called when the server has really ended this sign-in (refresh refused). Never for a bad connection. */
    @Volatile var onSessionEnded: (() -> Unit)? = null

    init {
        store.load()?.let { access = it.access; refresh = it.refresh }
    }

    /** True while a sign-in is saved on this phone (it may still be refused by the server when used). */
    val hasSession: Boolean get() = refresh.isNotEmpty()

    @Synchronized private fun setTokens(newAccess: String, newRefresh: String) {
        access = newAccess
        refresh = newRefresh
        if (newRefresh.isEmpty()) store.clear() else store.save(newAccess, newRefresh)
    }

    /** Result of a sign in. */
    data class Token(val access: String, val refresh: String, val kind: String, val mustChangePassword: Boolean)

    suspend fun login(email: String, password: String): Token {
        val body = JSONObject().put("email", email).put("password", password).put("device", "android")
        val json = request("POST", "/auth/login", body = body, authorised = false) as JSONObject
        setTokens(json.getString("access_token"), json.getString("refresh_token"))
        return Token(access, refresh, json.getString("kind"), json.optBoolean("must_change_password"))
    }

    /** Ends the session on the server (best effort) and forgets the tokens on this phone. */
    suspend fun signOut() {
        val had = access.isNotEmpty()
        try { if (had) request("POST", "/auth/logout") } catch (_: Exception) { }
        // Forget it on this phone even if the server could not be reached.
        setTokens("", "")
    }

    suspend fun getObject(path: String, query: Map<String, String?> = emptyMap()): JSONObject =
        request("GET", path, query) as JSONObject

    suspend fun getArray(path: String, query: Map<String, String?> = emptyMap()): JSONArray =
        request("GET", path, query) as JSONArray

    suspend fun send(method: String, path: String, body: JSONObject? = null, query: Map<String, String?> = emptyMap()): Any? =
        request(method, path, query, body)

    /**
     * Sends raw bytes to a presigned upload link (PUT with the headers the API gave). The link is absolute (R2) or, on a
     * local server, relative to the API host; it is not an API call, so no bearer token is sent to an absolute link.
     */
    suspend fun putBinary(uploadUrl: String, bytes: ByteArray, headers: Map<String, String>, method: String = "PUT") {
        val status = withContext(Dispatchers.IO) {
            val full = if (uploadUrl.startsWith("http")) uploadUrl else {
                val root = URL(baseUrl)
                "${root.protocol}://${root.authority}${if (uploadUrl.startsWith("/")) "" else "/"}$uploadUrl"
            }
            val conn = URL(full).openConnection() as HttpURLConnection
            try {
                conn.requestMethod = method
                conn.connectTimeout = 15_000
                conn.readTimeout = 120_000
                conn.doOutput = true
                conn.setFixedLengthStreamingMode(bytes.size)
                headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
                if (!uploadUrl.startsWith("http")) conn.setRequestProperty("Authorization", "Bearer $access")
                conn.outputStream.use { it.write(bytes) }
                conn.responseCode
            } catch (e: java.io.IOException) {
                throw ApiException("Can't reach the school server. Check your internet connection.")
            } finally {
                conn.disconnect()
            }
        }
        if (status !in 200..299) throw ApiException("The file could not be uploaded ($status). Please try again.")
    }

    private enum class Renewal { RENEWED, REJECTED, UNREACHABLE }

    /**
     * Renews the access token. [used] is the access token the failed request carried: if another caller already
     * renewed while this one waited for the lock, that result is reused instead of spending the refresh token again
     * (the server treats a refresh token used twice as theft).
     */
    private suspend fun renew(used: String): Renewal = refreshLock.withLock {
        val currentRefresh = refresh
        if (currentRefresh.isEmpty()) return@withLock Renewal.REJECTED
        if (access != used && access.isNotEmpty()) return@withLock Renewal.RENEWED
        try {
            val r = rawRequest("POST", "/auth/refresh", null, JSONObject().put("refresh_token", currentRefresh))
            if (r.status in 200..299) {
                val o = JSONObject(r.text)
                setTokens(o.getString("access_token"), o.getString("refresh_token"))
                Renewal.RENEWED
            } else if (r.status == 401 || r.status == 403) Renewal.REJECTED
            else Renewal.UNREACHABLE   // a server hiccup does not end the sign-in
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) { Renewal.UNREACHABLE }
    }

    private suspend fun request(
        method: String, path: String, query: Map<String, String?> = emptyMap(), body: JSONObject? = null,
        authorised: Boolean = true,
    ): Any? {
        val used = access
        var result = rawRequest(method, path, if (authorised) used else null, body, query)
        if (result.status == 401 && authorised) {
            when (renew(used)) {
                Renewal.RENEWED -> result = rawRequest(method, path, access, body, query)
                Renewal.REJECTED -> {
                    setTokens("", "")
                    onSessionEnded?.invoke()
                }
                Renewal.UNREACHABLE -> throw ApiException("Can't reach the school server. Check your internet connection.", "offline")
            }
        }
        if (result.status !in 200..299) throw ApiException(messageFrom(result.text, result.status), codeFrom(result.text))
        val text = result.text.trim()
        return when {
            text.isEmpty() -> JSONObject()
            text.startsWith("[") -> JSONArray(text)
            else -> JSONObject(text)
        }
    }

    private suspend fun rawRequest(
        method: String, path: String, bearer: String?, body: JSONObject?, query: Map<String, String?> = emptyMap(),
    ): Raw {
        transport?.let { return it.send(method, path, body, bearer) }
        return withContext(Dispatchers.IO) { call(method, path, query, body, bearer) }
    }

    private fun call(method: String, path: String, query: Map<String, String?>, body: JSONObject?, bearer: String?): Raw {
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
            if (bearer != null) conn.setRequestProperty("Authorization", "Bearer $bearer")
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            return Raw(status, stream?.bufferedReader()?.use { it.readText() } ?: "")
        } catch (e: java.io.IOException) {
            throw ApiException("Can't reach the school server. Check your internet connection.", "offline")
        } finally {
            conn.disconnect()
        }
    }

    private fun codeFrom(text: String): String? =
        try { JSONObject(text).optJSONObject("error")?.optString("code")?.takeIf { it.isNotEmpty() } } catch (_: Exception) { null }

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
fun JSONObject.strings(key: String): List<String> = arr(key).let { a -> (0 until a.length()).map { a.getString(it) } }
inline fun <T> JSONArray.mapObjects(block: (JSONObject) -> T): List<T> = (0 until length()).map { block(getJSONObject(it)) }
