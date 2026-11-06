package tech.krevo.app.features.staff

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import tech.krevo.app.data.staff.Broadcast
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.Krevo
import tech.krevo.app.features.messages.AttachmentList

/** One notice: the full text, each photo, who sent it and how many parents have read it. */
@Composable
internal fun StaffNoticeScreen(notice: Broadcast, onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    PushedPage("", onBack) {
        Text(notice.title, style = MaterialTheme.typography.headlineMedium, color = c.text)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill(notice.audience)
            Text("${notice.senderName} · ${StaffDates.instant(notice.createdAt)}", style = MaterialTheme.typography.bodySmall, color = c.textSecondary)
        }
        Text(notice.body, style = MaterialTheme.typography.bodyLarge, color = c.text)
        if (notice.attachments.isNotEmpty()) AttachmentList(notice.attachments, { staff.repo.attachmentUrl(it) }, c.text)
        HorizontalDivider(color = c.separator)
        KeyValue("Read by", "${notice.readCount} of ${notice.recipientCount}")
    }
}
