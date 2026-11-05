package tech.krevo.app.features.profile

import androidx.compose.ui.res.stringResource
import tech.krevo.app.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.krevo.app.design.Avatar
import tech.krevo.app.design.InfoRow
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoCard
import tech.krevo.app.design.KrevoList
import tech.krevo.app.design.ScreenHeader
import tech.krevo.app.design.SectionLabel
import tech.krevo.app.design.StatusBadge
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.Ist

@Composable
fun ProfileScreen(child: Child, onBack: () -> Unit) {
    KrevoList {
        item { ScreenHeader(
                ink = child.name,
                grey = "",
                onBack = onBack,
            ) }
        if (!child.isActive) item { LeftSchoolBanner(child) }
        item {
            KrevoCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Avatar(initials = child.initials, size = 56.dp)
                    Text(child.name, style = MaterialTheme.typography.titleLarge, color = Krevo.colors.text)
                }
                InfoRow(stringResource(R.string.profile_class), child.className)
                InfoRow(stringResource(R.string.profile_roll_no), child.rollNo.toString())
                InfoRow(stringResource(R.string.profile_scholar_no), child.scholarNo)
                InfoRow(stringResource(R.string.profile_dob), Ist.date(child.dob))
                Row(
                    modifier = Modifier.padding(top = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(stringResource(R.string.profile_status), style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary)
                    if (child.isActive) {
                        StatusBadge(stringResource(R.string.profile_active), Krevo.colors.success)
                    } else {
                        StatusBadge(stringResource(R.string.left_school), Krevo.colors.warning)
                    }
                }
            }
        }
        item {
            KrevoCard {
                SectionLabel(stringResource(R.string.profile_guardians))
                child.guardians.forEach { InfoRow(stringResource(R.string.profile_guardian), it) }
            }
        }
    }
}
