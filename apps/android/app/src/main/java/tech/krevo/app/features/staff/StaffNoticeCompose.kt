package tech.krevo.app.features.staff

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoTextField
import tech.krevo.app.design.PillButton
import tech.krevo.app.features.messages.AttachmentException
import tech.krevo.app.features.messages.AttachmentReader
import tech.krevo.app.features.messages.PendingAttachment

private const val MAX_PHOTOS = 5

/**
 * Write a notice: to the whole school (Announcements access) or a class you teach (every class, with Announcements
 * access), with up to five photos. Photos upload the way chat photos do, then the notice is posted with their ids.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ComposeNoticeSheet(onDismiss: () -> Unit, onSent: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val options = remember(staff.classes, staff.me) {
        (if (staff.me.canAnnounce) listOf("" to "Whole school") else emptyList()) + staff.announceClasses.map { it.id to "Class ${it.label}" }
    }
    var target by remember { mutableStateOf(options.firstOrNull()?.first ?: "") }
    LaunchedEffect(options) { if (options.none { it.first == target }) target = options.firstOrNull()?.first ?: "" }
    var title by remember { mutableStateOf("") }
    var text by remember { mutableStateOf("") }
    val photos = remember { mutableStateListOf<PendingAttachment>() }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(MAX_PHOTOS)) { uris ->
        scope.launch {
            error = null
            for (uri in uris.take(MAX_PHOTOS - photos.size)) {
                try { photos += AttachmentReader.read(context.contentResolver, uri) }
                catch (e: CancellationException) { throw e }
                catch (e: AttachmentException) { error = e.message }
                catch (_: Exception) { error = "That file can't be sent. Choose a photo." }
            }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.bg) {
        Column(Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("New notice", style = MaterialTheme.typography.headlineSmall, color = c.text)
            SmallLabel("To")
            if (options.isEmpty()) Text("You have no classes to write to yet.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
            else ChipRow(options, target) { target = it }
            KrevoTextField(value = title, onValueChange = { title = it }, label = "Title")
            KrevoTextField(value = text, onValueChange = { text = it }, label = "Message", singleLine = false, modifier = Modifier.heightIn(min = 140.dp))
            if (photos.isNotEmpty()) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    photos.forEach { p -> PhotoThumb(p, enabled = !busy) { photos.remove(p) } }
                }
            }
            if (photos.size < MAX_PHOTOS) {
                PillButton(
                    text = if (photos.isEmpty()) "Add photos" else "Add more", kind = ButtonKind.QUIET, enabled = !busy,
                    onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                )
            }
            error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.danger) }
            PillButton(
                text = "Send", kind = ButtonKind.BRAND, loading = busy, enabled = options.isNotEmpty(), modifier = Modifier.fillMaxWidth(),
                onClick = {
                    val t = title.trim(); val b = text.trim()
                    if (t.isEmpty() || b.isEmpty()) { error = "Add a title and a message."; return@PillButton }
                    scope.launch {
                        busy = true; error = null
                        try {
                            val ids = photos.map { staff.repo.uploadAttachment(it.bytes, it.filename, it.contentType) }
                            staff.repo.postBroadcast(t, b, target.ifEmpty { null }, ids)
                            haptic.success(); onSent()
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            error = e.message
                        }
                        busy = false
                    }
                },
            )
        }
    }
}

/** A small picked photo with a remove button on its corner. */
@Composable
private fun PhotoThumb(photo: PendingAttachment, enabled: Boolean, onRemove: () -> Unit) {
    val c = Krevo.colors
    Box(Modifier.size(64.dp)) {
        val thumb = photo.thumb
        val shape = RoundedCornerShape(14.dp)
        if (thumb != null) Image(thumb.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(64.dp).clip(shape))
        else Box(Modifier.size(64.dp).clip(shape).background(c.fill))
        if (enabled) {
            IconButton(onClick = onRemove, modifier = Modifier.size(28.dp).align(Alignment.TopEnd).background(c.solid.copy(alpha = 0.65f), RoundedCornerShape(14.dp))) {
                Icon(Icons.Filled.Close, contentDescription = "Remove photo", tint = c.onSolid, modifier = Modifier.size(14.dp))
            }
        }
    }
}
