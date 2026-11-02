package tech.slov.app.features.profile

import androidx.compose.ui.res.stringResource
import tech.slov.app.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.slov.app.design.Avatar
import tech.slov.app.design.InfoRow
import tech.slov.app.design.Slov
import tech.slov.app.design.SlovCard
import tech.slov.app.design.SlovList
import tech.slov.app.design.ScreenHeader
import tech.slov.app.design.SectionLabel
import tech.slov.app.design.StatusBadge
import tech.slov.app.domain.Child
import tech.slov.app.domain.Ist

@Composable
fun ProfileScreen(child: Child, onBack: () -> Unit) {
    SlovList {
        item { ScreenHeader(
                ink = stringResource(R.string.profile_title_ink),
                grey = stringResource(R.string.profile_title_grey, child.firstName),
                onBack = onBack,
            ) }
        if (!child.isActive) item { LeftSchoolBanner(child) }
        item {
            SlovCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Avatar(initials = child.initials, size = 56.dp)
                    Text(child.name, style = MaterialTheme.typography.titleLarge, color = Slov.colors.text)
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
                    Text(stringResource(R.string.profile_status), style = MaterialTheme.typography.bodyMedium, color = Slov.colors.textSecondary)
                    if (child.isActive) {
                        StatusBadge(stringResource(R.string.profile_active), Slov.colors.success)
                    } else {
                        StatusBadge(stringResource(R.string.left_school), Slov.colors.warning)
                    }
                }
            }
        }
        item {
            SlovCard {
                SectionLabel(stringResource(R.string.profile_guardians))
                child.guardians.forEach { InfoRow(stringResource(R.string.profile_guardian), it) }
            }
        }
    }
}
