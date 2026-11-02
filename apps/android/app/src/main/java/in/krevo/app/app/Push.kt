package `in`.krevo.app.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import `in`.krevo.app.R
import `in`.krevo.app.domain.NotificationCategory

/** Android notification channels: attendance, fees, general. Created at start-up (names follow the app language). */
object NotificationChannels {
    const val ATTENDANCE = "attendance"
    const val FEES = "fees"
    const val GENERAL = "general"

    /** The channel a push of this category should be posted to. Used by the FCM service once it exists. */
    fun idFor(category: NotificationCategory): String = when (category) {
        NotificationCategory.ATTENDANCE -> ATTENDANCE
        NotificationCategory.FEES -> FEES
        else -> GENERAL
    }

    fun create(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannels(
            listOf(
                NotificationChannel(ATTENDANCE, context.getString(R.string.channel_attendance), NotificationManager.IMPORTANCE_DEFAULT),
                NotificationChannel(FEES, context.getString(R.string.channel_fees), NotificationManager.IMPORTANCE_DEFAULT),
                NotificationChannel(GENERAL, context.getString(R.string.channel_general), NotificationManager.IMPORTANCE_DEFAULT),
            ),
        )
    }
}

/**
 * TODO(FCM): wire Firebase Cloud Messaging. Needs google-services.json and the com.google.gms.google-services
 * plugin, which are deliberately not added yet so the project still syncs. See "Push notifications" in README.md.
 * Until then [deviceToken] is a placeholder so the registration call path can be exercised against the mock.
 */
object PushSetup {
    const val PLATFORM = "android"

    fun deviceToken(): String = "local-placeholder-token"
}
