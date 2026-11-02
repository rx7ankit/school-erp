package `in`.krevo.app.features.password

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.krevo.app.R
import `in`.krevo.app.app.VmFactory
import `in`.krevo.app.data.Repository
import `in`.krevo.app.design.ButtonKind
import `in`.krevo.app.design.PillButton
import `in`.krevo.app.design.Krevo
import `in`.krevo.app.design.KrevoTextField
import `in`.krevo.app.design.ScreenHeader
import `in`.krevo.app.design.asString

/** [first] = forced change after a temporary password: no way back until it is done. */
@Composable
fun ChangePasswordScreen(
    first: Boolean,
    repository: Repository,
    onChanged: () -> Unit,
    showBack: Boolean,
    onBack: () -> Unit,
) {
    val vm: ChangePasswordViewModel = viewModel(factory = VmFactory { ChangePasswordViewModel(repository) })
    val ui by vm.ui.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 16.dp),
    ) {
        ScreenHeader(
            ink = stringResource(R.string.password_title),
            grey = stringResource(if (first) R.string.password_sub_first else R.string.password_sub_change),
            onBack = if (showBack) onBack else null,
        )
        Spacer(Modifier.height(16.dp))
        KrevoTextField(
            value = ui.newPassword,
            onValueChange = vm::setNew,
            label = stringResource(R.string.password_new),
            password = true,
            enabled = !ui.busy,
        )
        Spacer(Modifier.height(12.dp))
        KrevoTextField(
            value = ui.confirm,
            onValueChange = vm::setConfirm,
            label = stringResource(R.string.password_confirm),
            password = true,
            enabled = !ui.busy,
        )
        Text(
            text = stringResource(R.string.password_hint),
            style = MaterialTheme.typography.bodySmall,
            color = Krevo.colors.textSecondary,
            modifier = Modifier.padding(top = 12.dp),
        )
        val error = ui.error
        if (error != null) {
            Text(
                text = error.asString(),
                style = MaterialTheme.typography.bodyMedium,
                color = Krevo.colors.danger,
                modifier = Modifier
                    .padding(top = 12.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
        Spacer(Modifier.height(24.dp))
        PillButton(
            text = stringResource(if (ui.busy) R.string.saving else R.string.save_password),
            onClick = { vm.submit(onChanged) },
            kind = ButtonKind.BRAND,
            enabled = !ui.busy,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
