package tech.krevo.app.features.notices

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.krevo.app.design.Chip
import tech.krevo.app.design.Krevo
import tech.krevo.app.domain.Ist
import tech.krevo.app.domain.Notice
import tech.krevo.app.domain.Update

/** What the notice sheet shows. Built from either a school [Notice] or an [Update] of the feed. */
data class NoticeDetail(
    val id: String,
    val title: String,
    val body: String,
    val sender: String?,
    /** UTC ISO-8601 string. */
    val at: String,
    val attachment: String?,
)

fun Notice.detail() = NoticeDetail(id = id, title = title, body = body, sender = null, at = publishedAt, attachment = null)

fun Update.detail() = NoticeDetail(id = id, title = title.ifBlank { text.lineSequence().firstOrNull().orEmpty() }, body = text, sender = sender, at = at, attachment = attachment)

/** The full notice in a bottom sheet. Shared by Home (the notice slider) and Messages (the notices list). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoticeSheet(notice: NoticeDetail, onDismiss: () -> Unit) {
    val c = Krevo.colors
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = c.bg,
        contentColor = c.text,
        tonalElevation = 0.dp,
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .navigationBarsPadding()
                .padding(horizontal = 24.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(notice.title, style = MaterialTheme.typography.headlineSmall, color = c.text)
            Text(
                listOfNotNull(notice.sender, Ist.dateTime(notice.at)).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = c.textSecondary,
            )
            if (notice.body.isNotBlank()) Text(notice.body, style = MaterialTheme.typography.bodyLarge, color = c.text)
            notice.attachment?.let { Chip(it) }
            Column(Modifier.padding(bottom = 16.dp)) {}
        }
    }
}
