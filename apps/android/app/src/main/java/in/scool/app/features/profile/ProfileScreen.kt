package `in`.scool.app.features.profile

import androidx.compose.ui.res.stringResource
import `in`.scool.app.R
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
        item { ScreenHeader(
                ink = stringResource(R.string.profile_title_ink),
                grey = stringResource(R.string.profile_title_grey, child.firstName),
                onBack = onBack,
            ) }
        if (!child.isActive) item { LeftSchoolBanner(child) }
        item {
            ScoolCard {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Avatar(initials = child.initials, size = 56.dp)
                    Text(child.name, style = MaterialTheme.typography.titleLarge, color = Scool.colors.text)
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
                    Text(stringResource(R.string.profile_status), style = MaterialTheme.typography.bodyMedium, color = Scool.colors.textSecondary)
                    if (child.isActive) {
                        StatusBadge(stringResource(R.string.profile_active), Scool.colors.success)
                    } else {
                        StatusBadge(stringResource(R.string.left_school), Scool.colors.warning)
                    }
                }
            }
        }
        item {
            ScoolCard {
                SectionLabel(stringResource(R.string.profile_guardians))
                child.guardians.forEach { InfoRow(stringResource(R.string.profile_guardian), it) }
            }
        }
    }
}
