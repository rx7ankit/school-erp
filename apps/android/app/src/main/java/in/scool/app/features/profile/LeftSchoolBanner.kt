package `in`.scool.app.features.profile

import androidx.compose.ui.res.stringResource
import `in`.scool.app.R
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.Ist

/** Shown when a child's status is "left". Records stay readable, messaging is off. */
@Composable
fun LeftSchoolBanner(child: Child, modifier: Modifier = Modifier) {
    val on = child.leftOn?.let { Ist.date(it) }
    ScoolCard(modifier = modifier) {
        Text(
            text = if (on != null) stringResource(R.string.left_on, on) else stringResource(R.string.left_school),
            style = MaterialTheme.typography.titleMedium,
            color = Scool.colors.warning,
        )
        Text(
            text = stringResource(R.string.left_note, child.firstName),
            style = MaterialTheme.typography.bodyMedium,
            color = Scool.colors.textSecondary,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
