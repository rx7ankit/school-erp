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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import tech.krevo.app.data.staff.StaffMessage
import tech.krevo.app.data.staff.StaffThread
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.Radius
import tech.krevo.app.design.TwoToneTitle
import tech.krevo.app.domain.Ist
import tech.krevo.app.features.messages.AttachmentException
import tech.krevo.app.features.messages.AttachmentList
import tech.krevo.app.features.messages.AttachmentReader
import tech.krevo.app.features.messages.PendingAttachment

/** Messages tab for teachers: the conversations with parents, and the chat with photo and video attachments. */
@Composable
fun StaffMessagesScreen() {
    val state = LocalStaff.current
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    // The bottom bar steps aside while a chat is open.
    LaunchedEffect(openId) {
        state.chatOpen = openId != null
        if (openId == null) state.refreshUnreadMessages()
    }
    DisposableEffect(Unit) { onDispose { state.chatOpen = false } }
    val id = openId
    if (id == null) {
        ThreadList(onOpen = { openId = it })
    } else {
        androidx.activity.compose.BackHandler { openId = null; }
        StaffChat(threadId = id, onBack = {
            openId = null
        })
    }
}

@Composable
private fun ThreadList(onOpen: (String) -> Unit) {
    val state = LocalStaff.current
    val loader = rememberLoader(state) { state.repo.threads() }
    val c = Krevo.colors
    StaffPage(ink = "Messages.", grey = "Parents of your students.") {
        Loaded(loader) { threads ->
            if (threads.isEmpty()) EmptyNote("No conversations yet. Parents start them from their app.")
            threads.forEach { t ->
                TapCard(onClick = { onOpen(t.id) }) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        NameAvatar(t.studentName)
                        Column(Modifier.weight(1f)) {
                            Text(t.studentName, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1)
                            Text(
                                listOfNotNull(t.classLabel?.let { "Class $it" }, t.tag.ifEmpty { null }).joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall, color = c.textSecondary,
                            )
                            if (t.lastPreview.isNotEmpty()) {
                                Text(t.lastPreview, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, maxLines = 1)
                            }
                        }
                        if (t.unread > 0) ToneChip(t.unread.toString(), c.danger)
                    }
                }
            }
        }
    }
}

@Composable
private fun StaffChat(threadId: String, onBack: () -> Unit) {
    val state = LocalStaff.current
    val c = Krevo.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    val loader = rememberLoader(threadId) { state.repo.threadMessages(threadId) }
    val thread by produceThread(state, threadId)

    var draft by rememberSaveable { mutableStateOf("") }
    var pending by remember { mutableStateOf<PendingAttachment?>(null) }
    var preparing by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            preparing = true; error = null
            scope.launch {
                try { pending = AttachmentReader.read(context.contentResolver, uri) }
                catch (e: CancellationException) { throw e }
                catch (e: AttachmentException) { error = e.message }
                catch (_: Exception) { error = "That file can't be sent. Choose a photo or an MP4 video." }
                preparing = false
            }
        }
    }

    fun send() {
        val text = draft.trim()
        val file = pending
        if (sending || preparing || (text.isEmpty() && file == null)) return
        sending = true; error = null
        scope.launch {
            try {
                val ids = if (file != null) listOf(state.repo.uploadAttachment(file.bytes, file.filename, file.contentType)) else emptyList()
                val label = if (text.isEmpty() && file != null) (if (file.isVideo) "Video" else "Photo") else text
                val sent = state.repo.sendMessage(threadId, label, ids)
                (loader.state as? Ld.Ok)?.let { loader.set(it.value + sent) }
                draft = ""; pending = null
                haptic.success()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = e.message ?: "Couldn't send. Check your connection and try again."
            }
            sending = false
        }
    }

    Column(Modifier.fillMaxSize().imePadding()) {
        Row(Modifier.padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Back", tint = c.text)
            }
            Column(Modifier.padding(start = 4.dp)) {
                Text(thread?.studentName ?: "Chat", style = MaterialTheme.typography.titleLarge, color = c.text, maxLines = 1)
                thread?.let {
                    Text(
                        listOfNotNull(it.classLabel?.let { l -> "Class $l" }, it.tag.ifEmpty { null }).joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall, color = c.textSecondary,
                    )
                }
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            Loaded(loader) { messages ->
                val listState = rememberLazyListState()
                LaunchedEffect(messages.size) { if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex) }
                LazyColumn(
                    state = listState, modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(messages.size, key = { messages[it].id }) { i -> StaffBubble(messages[i]) { state.repo.attachmentUrl(it) } }
                }
            }
        }
        if (thread?.active == false) {
            Text("This conversation is closed.", style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, modifier = Modifier.padding(20.dp))
        } else {
            Column(Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
                error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.danger, modifier = Modifier.padding(bottom = 6.dp)) }
                val file = pending
                if (file != null || preparing) {
                    Row(
                        Modifier.padding(bottom = 8.dp).background(c.card, RoundedCornerShape(16.dp)).padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        if (file?.thumb != null) {
                            Image(file.thumb.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)))
                        } else {
                            Box(Modifier.size(48.dp).background(c.fill, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
                                Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = c.textSecondary)
                            }
                        }
                        Text(
                            when { preparing -> "Preparing…"; file?.isVideo == true -> "Video · ${file.bytes.size / 1024 / 1024 + 1} MB"; else -> "Photo" },
                            style = MaterialTheme.typography.bodyMedium, color = c.text, modifier = Modifier.weight(1f),
                        )
                        if (file != null && !sending) {
                            IconButton(onClick = { pending = null }, modifier = Modifier.size(40.dp)) {
                                Icon(Icons.Filled.Close, contentDescription = "Remove attachment", tint = c.textSecondary)
                            }
                        }
                    }
                }
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(
                        onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)) },
                        enabled = !sending && pending == null, modifier = Modifier.size(56.dp),
                        colors = IconButtonDefaults.iconButtonColors(containerColor = c.fill, contentColor = c.text, disabledContainerColor = c.fill, disabledContentColor = c.textTertiary),
                    ) { Icon(Icons.Filled.Add, contentDescription = "Add photo or video") }
                    androidx.compose.material3.OutlinedTextField(
                        value = draft, onValueChange = { draft = it; error = null }, modifier = Modifier.weight(1f),
                        label = { Text("Message") }, enabled = !sending, shape = RoundedCornerShape(Radius.control),
                        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = c.text, unfocusedBorderColor = c.separator, cursorColor = c.text,
                            focusedLabelColor = c.textSecondary, unfocusedLabelColor = c.textSecondary,
                            focusedTextColor = c.text, unfocusedTextColor = c.text,
                        ),
                    )
                    IconButton(
                        onClick = ::send, enabled = !sending && !preparing && (draft.isNotBlank() || pending != null), modifier = Modifier.size(56.dp),
                        colors = IconButtonDefaults.iconButtonColors(containerColor = c.accent, contentColor = c.onAccent, disabledContainerColor = c.fill, disabledContentColor = c.textTertiary),
                    ) {
                        if (sending) CircularProgressIndicator(color = c.onAccent, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                        else Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                    }
                }
            }
        }
    }
}

/** The thread's header details (name, class), taken from the list of conversations. */
@Composable
private fun produceThread(state: StaffState, id: String) =
    androidx.compose.runtime.produceState<StaffThread?>(null, id) {
        value = try { state.repo.threads().firstOrNull { it.id == id } } catch (e: CancellationException) { throw e } catch (_: Exception) { null }
    }

@Composable
private fun StaffBubble(m: StaffMessage, urlFor: suspend (String) -> String) {
    val c = Krevo.colors
    val bg = if (m.mine) c.solid else c.card
    val fg = if (m.mine) c.onSolid else c.text
    Box(Modifier.fillMaxWidth(), contentAlignment = if (m.mine) Alignment.CenterEnd else Alignment.CenterStart) {
        Surface(Modifier.widthIn(max = 300.dp), shape = RoundedCornerShape(Radius.card), color = bg, tonalElevation = 0.dp, shadowElevation = 0.dp) {
            Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                if (m.attachments.isNotEmpty()) {
                    AttachmentList(m.attachments, urlFor, fg)
                    Spacer(Modifier.size(6.dp))
                }
                val hide = m.attachments.isNotEmpty() && m.body in setOf("Photo", "Video", "")
                if (!hide) Text(m.body, style = MaterialTheme.typography.bodyLarge, color = fg)
                Text(Ist.dateTime(m.createdAt), style = MaterialTheme.typography.bodySmall, color = fg.copy(alpha = 0.7f), modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}
