package tech.krevo.app.data

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class ApiClientSessionTest {
    private fun json(vararg pairs: Pair<String, String>) = JSONObject().also { o -> pairs.forEach { o.put(it.first, it.second) } }.toString()

    /** A fake server: "old" access tokens are expired, refresh hands out new-N tokens. */
    private class Server(var refreshStatus: Int = 200) {
        val refreshCalls = AtomicInteger()
        var validAccess = "access-new"
        val transport = ApiClient.Transport { _, path, body, bearer ->
            if (path == "/auth/refresh") {
                refreshCalls.incrementAndGet()
                delay(50)
                if (refreshStatus == 200) {
                    ApiClient.Raw(200, JSONObject().put("access_token", "access-new").put("refresh_token", "refresh-new").toString())
                } else ApiClient.Raw(refreshStatus, "")
            } else if (bearer == validAccess) ApiClient.Raw(200, """{"ok":true}""")
            else ApiClient.Raw(401, "")
        }
    }

    @Test fun tokensAreLoadedAtStartAndSavedOnRefresh() = runBlocking {
        val store = InMemoryTokenStore(SavedTokens("access-old", "refresh-old"))
        val server = Server()
        val api = ApiClient("http://x", store, server.transport)
        assertTrue(api.hasSession)
        api.getObject("/auth/me")
        assertEquals(SavedTokens("access-new", "refresh-new"), store.load())
    }

    @Test fun manyExpiredRequestsShareOneRefresh() = runBlocking {
        val store = InMemoryTokenStore(SavedTokens("access-old", "refresh-old"))
        val server = Server()
        val api = ApiClient("http://x", store, server.transport)
        (1..8).map { async { api.getObject("/thing$it") } }.awaitAll()
        assertEquals(1, server.refreshCalls.get())
    }

    @Test fun refusedRefreshEndsSessionAndClearsStore() = runBlocking {
        val store = InMemoryTokenStore(SavedTokens("access-old", "refresh-old"))
        val server = Server(refreshStatus = 401)
        val api = ApiClient("http://x", store, server.transport)
        var ended = 0
        api.onSessionEnded = { ended++ }
        try { api.getObject("/auth/me"); fail() } catch (_: ApiException) { }
        assertEquals(1, ended)
        assertNull(store.load())
        assertFalse(api.hasSession)
    }

    @Test fun serverErrorOnRefreshKeepsTheSignIn() = runBlocking {
        val store = InMemoryTokenStore(SavedTokens("access-old", "refresh-old"))
        val server = Server(refreshStatus = 503)
        val api = ApiClient("http://x", store, server.transport)
        var ended = 0
        api.onSessionEnded = { ended++ }
        try { api.getObject("/auth/me"); fail() } catch (e: ApiException) { assertEquals("offline", e.code) }
        assertEquals(0, ended)
        assertEquals(SavedTokens("access-old", "refresh-old"), store.load())
        assertTrue(api.hasSession)
    }

    @Test fun networkFailureOnRefreshKeepsTheSignIn() = runBlocking {
        val store = InMemoryTokenStore(SavedTokens("access-old", "refresh-old"))
        val api = ApiClient("http://x", store) { _, path, _, _ ->
            if (path == "/auth/refresh") throw ApiException("offline", "offline") else ApiClient.Raw(401, "")
        }
        var ended = 0
        api.onSessionEnded = { ended++ }
        try { api.getObject("/auth/me"); fail() } catch (_: ApiException) { }
        assertEquals(0, ended)
        assertTrue(api.hasSession)
    }

    @Test fun signOutClearsStoredTokens() = runBlocking {
        val store = InMemoryTokenStore(SavedTokens("access-new", "refresh-new"))
        val api = ApiClient("http://x", store, Server().transport)
        api.signOut()
        assertNull(store.load())
        assertFalse(api.hasSession)
    }
}
