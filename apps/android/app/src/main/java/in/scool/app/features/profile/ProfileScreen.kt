package `in`.scool.app.features.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import `in`.scool.app.design.Avatar
import `in`.scool.app.design.InfoRow
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.SectionLabel
import `in`.scool.app.design.StatusBadge
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.Ist

@Composable
fun ProfileScreen(child: Child, onBack: () -> Unit) {
    ScoolList {
        item { ScreenHeader(ink = "Profile.", grey = child.firstName + "'s details.", onBack = onBack) }
        if (!child.isActive) item { LeftSchoolBanner(child) }
        item {
            ScoolCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Avatar(initials = child.initials, size = 56.dp)
                    Text(child.name, style = MaterialTheme.typography.titleLarge, color = Scool.colors.text)
                }
                InfoRow("Class", child.className)
                InfoRow("Roll no", child.rollNo.toString())
                InfoRow("Scholar no", child.scholarNo)
                InfoRow("Date of birth", Ist.date(child.dob))
                Row(
                    modifier = Modifier.padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Status", style = MaterialTheme.typography.bodyMedium, color = Scool.colors.textSecondary)
                    if (child.isActive) {
                        StatusBadge("Active", Scool.colors.success)
                    } else {
                        StatusBadge("Left school", Scool.colors.warning)
                    }
                }
            }
        }
        item {
            ScoolCard {
                SectionLabel("Guardians")
                child.guardians.forEach { InfoRow("Guardian", it) }
            }
        }
    }
}
