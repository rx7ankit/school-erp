package tech.slov.app.design

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import tech.slov.app.domain.UiText

/** Resolves a [UiText] in the active app language. */
@Composable
fun UiText.asString(): String = when (this) {
    is UiText.Raw -> value
    is UiText.Res -> stringResource(id, *args.toTypedArray())
}
