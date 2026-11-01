package `in`.scool.app.features.more

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader

@Composable
fun MoreScreen(onFees: () -> Unit, onNotices: () -> Unit, onProfile: () -> Unit, onSettings: () -> Unit) {
    ScoolList {
        item { ScreenHeader(ink = "More.", grey = "Fees, notices, profile.") }
        item { MoreRow("Fees", "Invoices and receipts", onFees) }
        item { MoreRow("Notices and calendar", "Announcements, holidays, exams", onNotices) }
        item { MoreRow("Child profile", "Class, roll number, guardians", onProfile) }
        item { MoreRow("Settings", "Appearance, password, sign out", onSettings) }
    }
}

@Composable
private fun MoreRow(title: String, subtitle: String, onClick: () -> Unit) {
    ScoolCard(onClick = onClick) {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            androidx.compose.foundation.layout.Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = Scool.colors.text)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = Scool.colors.textSecondary)
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = Scool.colors.textTertiary)
        }
    }
}
