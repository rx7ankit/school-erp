package tech.krevo.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** The saved sign-in: the access and refresh tokens. */
data class SavedTokens(val access: String, val refresh: String)

/**
 * Keeps the sign-in on this phone so closing the app, restarting the phone or installing an update keeps you
 * signed in. Only signing out (or the school ending the session) clears it.
 */
interface TokenStore {
    fun load(): SavedTokens?
    fun save(access: String, refresh: String)
    fun clear()
}

/** Tokens held in memory only (tests, and the default when no store is given). */
class InMemoryTokenStore(private var saved: SavedTokens? = null) : TokenStore {
    override fun load() = saved
    override fun save(access: String, refresh: String) { saved = if (refresh.isEmpty()) null else SavedTokens(access, refresh) }
    override fun clear() { saved = null }
}

/**
 * Tokens in EncryptedSharedPreferences (AES-256, key in the Android Keystore). If the keystore cannot be used
 * (rare: a restored backup or a broken keystore), the unreadable file is dropped and the person signs in again,
 * rather than crashing.
 */
class EncryptedTokenStore(private val context: Context) : TokenStore {
    private val prefs: SharedPreferences? by lazy { open() }

    private fun open(): SharedPreferences? {
        fun create(): SharedPreferences {
            val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            return EncryptedSharedPreferences.create(
                context, FILE, key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }
        return try { create() } catch (_: Exception) {
            try { context.deleteSharedPreferences(FILE); create() } catch (_: Exception) { null }
        }
    }

    override fun load(): SavedTokens? = try {
        val p = prefs
        val refresh = p?.getString(REFRESH, null).orEmpty()
        if (p == null || refresh.isEmpty()) null else SavedTokens(p.getString(ACCESS, null).orEmpty(), refresh)
    } catch (_: Exception) { null }

    override fun save(access: String, refresh: String) {
        if (refresh.isEmpty()) return clear()
        try { prefs?.edit()?.putString(ACCESS, access)?.putString(REFRESH, refresh)?.apply() } catch (_: Exception) { }
    }

    override fun clear() {
        try { prefs?.edit()?.clear()?.apply() } catch (_: Exception) { }
    }

    private companion object {
        const val FILE = "krevo_session"
        const val ACCESS = "access"
        const val REFRESH = "refresh"
    }
}
