package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import tech.krevo.app.design.Krevo

/** The Fees tab, for whoever holds the Fees permission: collection at a glance and who owes what. */
@Composable
internal fun StaffFeesScreen() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val summary = rememberLoader { staff.repo.feesSummary() }
    var query by rememberSaveable { mutableStateOf("") }
    var debounced by remember { mutableStateOf("") }
    LaunchedEffect(query) { if (query.isNotEmpty()) delay(300); debounced = query }
    val dues = rememberLoader(debounced) { staff.repo.dues(debounced) }

    RootPage {
        Loaded(summary) { s ->
            Column {
                Text(rupees(s.collectedPaise), style = MaterialTheme.typography.headlineLarge, color = c.text)
                Text("collected of ${rupees(s.billedPaise)} billed" + (s.year?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                ThinProgress(((s.collectionPercentage ?: 0.0) / 100).coerceIn(0.0, 1.0).toFloat(), Modifier.padding(vertical = 12.dp))
                KeyLine("Dues", rupees(s.duesPaise), c.text)
                HorizontalDivider(color = c.separator)
                KeyLine("Overdue", rupees(s.overduePaise), c.danger)
            }
            if (s.topDues.isNotEmpty()) {
                Column {
                    SmallLabel("Most dues")
                    s.topDues.take(3).forEachIndexed { i, d ->
                        PlainRow(
                            title = "Class ${d.classLabel}", subtitle = "${d.students} students", divider = i < minOf(3, s.topDues.size) - 1,
                            accessory = { Text(rupees(d.duesPaise), style = MaterialTheme.typography.titleSmall, color = c.text) },
                        )
                    }
                }
            }
        }
        SmallLabel("Students who owe fees")
        SearchField(query, { query = it }, "Search name or scholar number")
        Loaded(dues) { rows ->
            if (rows.isEmpty()) EmptyNote("No dues found.")
            Column {
                rows.forEachIndexed { i, r ->
                    PlainRow(
                        title = r.studentName,
                        subtitle = listOfNotNull(r.classLabel?.let { "Class $it" }, r.guardianName, if (r.overduePaise > 0) "${rupees(r.overduePaise)} overdue" else null).joinToString(" · "),
                        divider = i < rows.lastIndex,
                        accessory = {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(rupees(r.duePaise), style = MaterialTheme.typography.titleSmall, color = c.text)
                                r.guardianPhone?.let { CallButton(it) }
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun KeyLine(label: String, value: String, valueColor: androidx.compose.ui.graphics.Color) {
    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary)
        Text(value, style = MaterialTheme.typography.titleSmall, color = valueColor)
    }
}
