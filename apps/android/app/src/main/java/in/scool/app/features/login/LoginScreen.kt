package `in`.scool.app.features.login

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.R
import `in`.scool.app.app.SessionViewModel
import `in`.scool.app.app.VmFactory
import `in`.scool.app.data.Repository
import `in`.scool.app.design.ButtonKind
import `in`.scool.app.design.PillButton
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolTextField
import `in`.scool.app.design.TwoToneTitle
import `in`.scool.app.design.asString
import `in`.scool.app.features.language.LanguageChooser
import `in`.scool.app.features.language.LanguageSwitch

@Composable
fun LoginScreen(repository: Repository, session: SessionViewModel) {
    val vm: LoginViewModel = viewModel(factory = VmFactory { LoginViewModel(repository, session) })
    val ui by vm.ui.collectAsStateWithLifecycle()
    val language by session.language.collectAsStateWithLifecycle()
    val languageChosen by session.languageChosen.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
    ) {
        // First launch: the chooser sits at the very top. Afterwards a compact EN | हि switch stays within reach.
        when (languageChosen) {
            false -> {
                LanguageChooser(onChoose = session::setLanguage)
                Spacer(Modifier.height(24.dp))
            }
            true -> {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    LanguageSwitch(selected = language, onSelect = session::setLanguage)
                }
                Spacer(Modifier.height(16.dp))
            }
            null -> Unit
        }
        Icon(
            painter = painterResource(R.drawable.ic_scool_mark),
            contentDescription = stringResource(R.string.login_logo),
            tint = Scool.colors.text,
            modifier = Modifier.size(64.dp),
        )
        Spacer(Modifier.height(32.dp))
        TwoToneTitle(ink = stringResource(R.string.login_title_ink), grey = stringResource(R.string.login_title_grey))
        Spacer(Modifier.height(32.dp))
        ScoolTextField(
            value = ui.email,
            onValueChange = vm::setEmail,
            label = stringResource(R.string.email),
            keyboardType = KeyboardType.Email,
            enabled = !ui.busy,
        )
        Spacer(Modifier.height(12.dp))
        ScoolTextField(
            value = ui.password,
            onValueChange = vm::setPassword,
            label = stringResource(R.string.password),
            password = true,
            enabled = !ui.busy,
        )
        val error = ui.error
        if (error != null) {
            Text(
                text = error.asString(),
                style = MaterialTheme.typography.bodyMedium,
                color = Scool.colors.danger,
                modifier = Modifier
                    .padding(top = 12.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
        Spacer(Modifier.height(24.dp))
        PillButton(
            text = stringResource(if (ui.busy) R.string.signing_in else R.string.sign_in),
            onClick = vm::submit,
            kind = ButtonKind.BRAND,
            enabled = !ui.busy,
            modifier = Modifier.fillMaxWidth(),
        )
        Text(
            text = stringResource(R.string.login_hint),
            style = MaterialTheme.typography.bodySmall,
            color = Scool.colors.textSecondary,
            modifier = Modifier.padding(top = 16.dp),
        )
    }
}
