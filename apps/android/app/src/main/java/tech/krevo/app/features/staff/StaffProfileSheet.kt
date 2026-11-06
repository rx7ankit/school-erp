package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.PillButton
import tech.krevo.app.features.messages.AttachmentReader

/** The longest side of an uploaded profile picture, in pixels. */
private const val PHOTO_EDGE = 800

/** The popup behind the round picture on Home: who is signed in, their role, and the controls for their photo. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ProfileSheet(onDismiss: () -> Unit) {
    val staff = LocalStaff.current
    val me = staff.me
    val c = Krevo.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun save(read: suspend () -> ByteArray?) {
        scope.launch {
            saving = true; error = null
            try {
                staff.setPhoto(read())
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = e.message ?: "The photo could not be saved. Try again."
            }
            saving = false
        }
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) save { AttachmentReader.profilePhoto(context.contentResolver, uri, PHOTO_EDGE) }
    }
    val pick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.bg) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Box(Modifier.size(104.dp).clickable(enabled = !saving, onClick = pick).semantics { contentDescription = "Change your photo" }) {
                PersonAvatar(me.name, me.photoUrl, 96.dp, Modifier.align(Alignment.Center))
                Box(
                    Modifier.align(Alignment.BottomEnd).size(34.dp).background(c.accent, CircleShape).border(2.dp, c.bg, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    if (saving) CircularProgressIndicator(Modifier.size(16.dp), color = c.onAccent, strokeWidth = 2.dp)
                    else Icon(StaffIcons.Camera, contentDescription = null, tint = c.onAccent, modifier = Modifier.size(16.dp))
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(me.name, style = MaterialTheme.typography.headlineSmall, color = c.text, textAlign = TextAlign.Center)
                Text(me.email, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                Pill(me.roleTitle, color = c.text)
                me.schoolName?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = c.textSecondary) }
            }
            error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.danger, textAlign = TextAlign.Center) }
            if (me.photoUrl != null) {
                Text(
                    "Remove photo", style = MaterialTheme.typography.labelLarge, color = if (saving) c.textTertiary else c.textSecondary,
                    modifier = Modifier.clickable(enabled = !saving) { save { null } }.padding(12.dp),
                )
            }
            PillButton(text = "Sign out", onClick = { onDismiss(); staff.onSignOut() }, kind = ButtonKind.SOLID, modifier = Modifier.fillMaxWidth())
        }
    }
}
