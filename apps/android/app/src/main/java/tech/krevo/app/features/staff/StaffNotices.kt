package tech.krevo.app.features.staff

import androidx.compose.foundation.clickable
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
        LazyColumn(Modifier.fillMaxSize(), state = listState, contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp)) {
            when (val s = state) {
                Ld.Loading -> item { StaffSkeleton(4) }
                is Ld.Failed -> item { ErrorNote(s.message) { scope.launch { reload() } } }
                is Ld.Ok -> {
                    if (pages.items.isEmpty()) item { EmptyNote("No notices yet.") }
                    items(pages.items, key = { it.id }) { b ->
                        NoticeRow(b, last = b.id == pages.items.last().id) { staff.push(StaffDest.Notice(b)) }
                    }
                    if (loadingMore) item { CircularProgressIndicator(Modifier.fillMaxWidth().padding(8.dp).size(24.dp), color = c.textTertiary, strokeWidth = 2.dp) }
                }
            }
        }
    }
    if (composing) ComposeNoticeSheet(onDismiss = { composing = false }) { composing = false; scope.launch { reload() } }
}

@Composable
private fun NoticeRow(b: Broadcast, last: Boolean, onClick: () -> Unit) {
    val c = Krevo.colors
    Column(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.fillMaxWidth().padding(vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Text(b.title, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(end = 8.dp))
                Pill(b.audience)
            }
            Text(b.body, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (b.attachments.isNotEmpty()) {
                    Icon(StaffIcons.Photo, contentDescription = "Photos", tint = c.textTertiary, modifier = Modifier.size(14.dp))
                    Text(b.attachments.size.toString(), style = MaterialTheme.typography.bodySmall, color = c.textTertiary)
                }
                Text("${b.senderName} · ${StaffDates.instant(b.createdAt)}", style = MaterialTheme.typography.bodySmall, color = c.textTertiary)
            }
        }
        if (!last) HorizontalDivider(color = c.separator)
    }
}
