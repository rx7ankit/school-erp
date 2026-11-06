package tech.krevo.app.app

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import tech.krevo.app.R

/**
 * Receives pushes from the API through FCM. With the app in the background the system draws the notification itself
 * (the API sets the channel); this class draws it when the app is open, and re-registers the phone when Google
 * rotates the token.
 */
class KrevoMessagingService : FirebaseMessagingService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        val repo = (application as KrevoApplication).container.repository
        scope.launch {
            // Not signed in yet: the next sign in registers the fresh token anyway.
            try { repo.registerDevice(token, PushSetup.PLATFORM) } catch (_: Exception) { }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val note = message.notification ?: return
        if (needsPermission() && !hasPermission()) return
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val channel = message.data["channel"]?.takeIf { it in listOf("attendance", "fees", "general") } ?: NotificationChannels.GENERAL
        val built = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_krevo_mark)
            .setContentTitle(note.title)
            .setContentText(note.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(note.body))
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        NotificationManagerCompat.from(this).notify(message.messageId.hashCode(), built)
    }

    @Suppress("FunctionName")
    private fun needsPermission() = android.os.Build.VERSION.SDK_INT >= 33

    private fun hasPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
}
