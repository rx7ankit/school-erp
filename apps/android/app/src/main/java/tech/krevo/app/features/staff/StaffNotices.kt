package tech.krevo.app.features.staff

import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import tech.krevo.app.features.messages.rememberAttachmentBitmap
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.Broadcast
import tech.krevo.app.data.staff.NoticePages
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.Krevo

/**
 * The Notices page: every notice, newest first, 20 at a time (the next page loads as you reach the end). Tap one to open
 * it. Whoever may write (Announcements access, or a teacher with a class) gets a compose button at the top right.
 */
@Composable
internal fun StaffNoticesScreen(onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var pages by remember { mutableStateOf(NoticePages()) }
    var state by remember { mutableStateOf<Ld<Unit>>(Ld.Loading) }
    var loadingMore by remember { mutableStateOf(false) }
    var composing by remember { mutableStateOf(false) }

    suspend fun reload() {
        try {
            val page = staff.repo.broadcastPage(0)
            pages = NoticePages(page.items, page.total); state = Ld.Ok(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (pages.items.isEmpty()) state = Ld.Failed(e.message ?: "Something went wrong. Please try again.")
        }
    }
    LaunchedEffect(Unit) { reload() }

    // Load the next page when the last row comes into view.
    LaunchedEffect(listState, pages) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }.collect { last ->
            if (!loadingMore && pages.hasMore && last >= pages.items.size - 1) {
                loadingMore = true
                try {
                    pages = pages.appended(staff.repo.broadcastPage(pages.nextOffset))
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) { }
                loadingMore = false
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        PushedHeader("Notices", onBack, action = {
            if (staff.me.canWriteNotice) {
                IconButton(onClick = { composing = true }, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Filled.Edit, contentDescription = "New notice", tint = c.text)
                }
            }
        })
        LazyColumn(Modifier.fillMaxSize(), state = listState, contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (val s = state) {
                Ld.Loading -> item { StaffSkeleton(4) }
                is Ld.Failed -> item { ErrorNote(s.message) { scope.launch { reload() } } }
                is Ld.Ok -> {
                    if (pages.items.isEmpty()) item { EmptyNote("No notices yet.") }
                    items(pages.items, key = { it.id }) { b ->
                        NoticeCard(b) { staff.push(StaffDest.Notice(b)) }
                    }
                    if (loadingMore) item { CircularProgressIndicator(Modifier.fillMaxWidth().padding(8.dp).size(24.dp), color = c.textTertiary, strokeWidth = 2.dp) }
                }
            }
        }
    }
    if (composing) ComposeNoticeSheet(onDismiss = { composing = false }) { composing = false; scope.launch { reload() } }
}

/**
 * A notice as a card: its first photo fills it with a dark layer over the bottom carrying the title and date in white;
 * with no photo it is a grey card with dark text. An orange "New" chip sits top left until the notice has been opened.
 */
@Composable
private fun NoticeCard(b: Broadcast, onClick: () -> Unit) {
    val staff = LocalStaff.current
    val reads = LocalNoticeReads.current
    val c = Krevo.colors
    val shape = RoundedCornerShape(24.dp)
    val photoId = b.attachments.firstOrNull { it.isImage }?.id
    val bitmap = photoId?.let { id -> rememberAttachmentBitmap(id, { staff.repo.attachmentUrl(it) }, sampleSize = 2).value }
    val hasPhoto = photoId != null
    val titleColor = if (hasPhoto) Color.White else c.text
    val dateColor = if (hasPhoto) Color.White.copy(alpha = 0.7f) else c.textSecondary
    Box(Modifier.fillMaxWidth().height(200.dp).clip(shape).background(if (hasPhoto) Color(0xFF383B42) else c.card).clickable(onClick = onClick)) {
        if (hasPhoto) {
            // Dark slate until the picture arrives.
            Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0xFF383B42), Color(0xFF212429)))))
            bitmap?.let { Image(it.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize()) }
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.35f to Color.Transparent, 0.7f to Color.Black.copy(alpha = 0.45f), 1f to Color.Black.copy(alpha = 0.85f))))
        }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(b.title, style = MaterialTheme.typography.titleLarge, color = titleColor, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(StaffDates.instant(b.createdAt), style = MaterialTheme.typography.bodySmall, color = dateColor, maxLines = 1)
        }
        if (reads.isNew(b.id)) {
            Text(
                "New", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = c.onAccent,
                modifier = Modifier.align(Alignment.TopStart).padding(12.dp).clip(CircleShape).background(c.accent).padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
    }
}
