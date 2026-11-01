package `in`.scool.app.features.staff

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
import `in`.scool.app.design.ButtonKind
import `in`.scool.app.design.PillButton
import `in`.scool.app.design.Scool
import `in`.scool.app.design.TwoToneTitle

/** Placeholder for staff users. */
@Composable
fun StaffScreen(name: String, onSignOut: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 48.dp)) {
        TwoToneTitle(ink = "Staff app is coming.", grey = "Use the web app today.")
        if (name.isNotBlank()) {
            Text(
                text = "Signed in as $name",
                style = MaterialTheme.typography.bodyMedium,
                color = Scool.colors.textSecondary,
                modifier = Modifier.padding(top = 12.dp),
            )
        }
        Spacer(Modifier.height(32.dp))
        PillButton(text = "Sign out", onClick = onSignOut, kind = ButtonKind.SOLID, modifier = Modifier.fillMaxWidth())
    }
}
