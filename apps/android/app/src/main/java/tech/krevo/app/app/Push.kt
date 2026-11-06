package tech.krevo.app.app

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import tech.krevo.app.R
import tech.krevo.app.domain.NotificationCategory

/** Android notification channels: attendance, fees, general. Created at start-up (names follow the app language). */
object NotificationChannels {
    const val ATTENDANCE = "attendance"
    const val FEES = "fees"
    const val GENERAL = "general"

    /** The channel a push of this category should be posted to. */
    fun idFor(category: NotificationCategory): String = when (category) {
        NotificationCategory.ATTENDANCE -> ATTENDANCE
        NotificationCategory.FEES -> FEES
        else -> GENERAL
    }

    /** The channel for a push, from the server's `kind` (fee_invoice, attendance_absent, ...). */
    fun idForKind(kind: String): String = when {
        kind.startsWith("fee_") -> FEES
        kind.startsWith("attendance_") || kind == "leave_decided" -> ATTENDANCE
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

/** The Firebase (FCM) device token. Needs google-services.json at build time; without it the app runs with no push. */
object PushSetup {
    const val PLATFORM = "android"

    /** The token to register with the server, or null when Firebase is not set up in this build or Google Play services is missing. */
    suspend fun deviceToken(context: Context): String? = try {
        if (FirebaseApp.getApps(context).isEmpty()) null else FirebaseMessaging.getInstance().token.await()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        null
    }
}

/** Where a tapped push leads: the server's `kind` and the child (`student_id`) it is about. */
data class PushTarget(val kind: String, val studentId: String?)

/**
 * Carries a tapped push from the activity to the UI. The server sends `kind`, `student_id` and `notification_id` in
 * every push; Android puts those on the launch intent when the system draws the notification itself.
 */
object PushLinks {
    const val EXTRA_KIND = "kind"
    const val EXTRA_STUDENT = "student_id"

    private val _target = MutableStateFlow<PushTarget?>(null)
    val target: StateFlow<PushTarget?> = _target.asStateFlow()

    /** Call with the activity's intent on start and in onNewIntent. Does nothing for an ordinary launch. */
    fun handle(intent: Intent?) {
        val kind = intent?.getStringExtra(EXTRA_KIND) ?: return
        _target.value = PushTarget(kind, intent.getStringExtra(EXTRA_STUDENT))
        intent.removeExtra(EXTRA_KIND)
        intent.removeExtra(EXTRA_STUDENT)
    }

    fun consume() { _target.value = null }

    /** The screen a push of this kind opens. Anything unknown opens the notification centre. */
    fun routeFor(kind: String): String = when {
        kind.startsWith("fee_") || kind == "library_due" -> Routes.FEES
        kind.startsWith("attendance_") || kind == "leave_decided" -> Routes.ATTENDANCE
        kind == "result" -> Routes.RESULTS
        kind == "exam" -> Routes.NOTICES_EXAMS
        kind == "message" || kind == "broadcast" -> Routes.MESSAGES
        kind == "feedback" -> Routes.FEEDBACK
        else -> Routes.NOTIFICATIONS
    }
}

/**
 * Receives pushes. While the app is closed or in the background Android draws the notification itself (the server
 * sends a notification payload); this service draws it when the app is open, and keeps the server's copy of the
 * device token fresh when Firebase rotates it.
 */
class KrevoMessagingService : FirebaseMessagingService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        val repository = (application as KrevoApplication).container.repository
        // Signed out? The call fails and is ignored: the app registers the current token again at the next sign in.
        scope.launch { try { repository.registerDevice(token, PushSetup.PLATFORM) } catch (_: Exception) { } }
    }

    @SuppressLint("MissingPermission") // areNotificationsEnabled() covers the Android 13+ permission
    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: message.data["title"] ?: return
        val body = message.notification?.body ?: message.data["body"].orEmpty()
        val manager = NotificationManagerCompat.from(this)
        if (!manager.areNotificationsEnabled()) return
        val kind = message.data["kind"].orEmpty()
        val open = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(PushLinks.EXTRA_KIND, kind)
            message.data["student_id"]?.let { putExtra(PushLinks.EXTRA_STUDENT, it) }
        }
        val id = (message.data["notification_id"] ?: message.messageId ?: title).hashCode()
        val tap = PendingIntent.getActivity(this, id, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification = NotificationCompat.Builder(this, NotificationChannels.idForKind(kind))
            .setSmallIcon(R.drawable.ic_krevo_mark)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(tap)
            .build()
        manager.notify(id, notification)
    }
}
