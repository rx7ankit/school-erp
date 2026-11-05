package tech.krevo.app.features.profile

import androidx.compose.ui.res.stringResource
import tech.krevo.app.R
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoCard
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.Ist

/** Shown when a child's status is "left". Records stay readable, messaging is off. */
@Composable
fun LeftSchoolBanner(child: Child, modifier: Modifier = Modifier) {
    val on = child.leftOn?.let { Ist.date(it) }
    KrevoCard(modifier = modifier) {
        Text(
            text = if (on != null) stringResource(R.string.left_on, on) else stringResource(R.string.left_school),
            style = MaterialTheme.typography.titleMedium,
            color = Krevo.colors.warning,
        )
        Text(
            text = stringResource(R.string.left_note, child.firstName),
            style = MaterialTheme.typography.bodyMedium,
            color = Krevo.colors.textSecondary,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}
