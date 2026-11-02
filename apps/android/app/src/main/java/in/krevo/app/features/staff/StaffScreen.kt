package `in`.krevo.app.features.staff

import androidx.compose.ui.res.stringResource
import `in`.krevo.app.R
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import `in`.krevo.app.design.ButtonKind
import `in`.krevo.app.design.PillButton
import `in`.krevo.app.design.Krevo
import `in`.krevo.app.design.TwoToneTitle

/** Placeholder for staff users. */
@Composable
fun StaffScreen(name: String, onSignOut: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 48.dp)) {
        TwoToneTitle(ink = stringResource(R.string.staff_title_ink), grey = stringResource(R.string.staff_title_grey))
        if (name.isNotBlank()) {
            Text(
                text = stringResource(R.string.staff_signed_in_as, name),
                style = MaterialTheme.typography.bodyMedium,
                color = Krevo.colors.textSecondary,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
        Spacer(Modifier.height(32.dp))
        PillButton(text = stringResource(R.string.sign_out), onClick = onSignOut, kind = ButtonKind.SOLID, modifier = Modifier.fillMaxWidth())
    }
}
