package tech.krevo.app.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import tech.krevo.app.R
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.suspendCancellableCoroutine
import tech.krevo.app.domain.NotificationCategory
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

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

/** Firebase Cloud Messaging: the device token the API sends pushes to. */
object PushSetup {
    const val PLATFORM = "android"

    /** This phone's FCM token. Throws if Google Play services are missing; the caller treats push as optional. */
    suspend fun deviceToken(): String = suspendCancellableCoroutine { cont ->
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { cont.resume(it) }
            .addOnFailureListener { cont.resumeWithException(it) }
    }
}
