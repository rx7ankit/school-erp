package tech.slov.app.design

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import tech.slov.app.R
import tech.slov.app.domain.Load
import tech.slov.app.domain.UiText

/** Two-tone heading: an ink phrase, then a grey phrase. */
@Composable
fun TwoToneTitle(ink: String, grey: String, modifier: Modifier = Modifier) {
    val c = Slov.colors
    val text = buildAnnotatedString {
        withStyle(SpanStyle(color = c.text)) { append(ink) }
        append(" ")
        withStyle(SpanStyle(color = c.textTertiary)) { append(grey) }
    }
    Text(
        text = text,
        style = MaterialTheme.typography.headlineLarge,
        modifier = modifier.semantics { heading() },
    )
}

/** Screen header: optional back button, two-tone title, optional context line (e.g. the child's name). */
@Composable
fun ScreenHeader(
    ink: String,
    grey: String,
    modifier: Modifier = Modifier,
    context: String? = null,
    onBack: (() -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth().padding(top = 8.dp, bottom = 8.dp)) {
        if (onBack != null) {
            IconButton(onClick = onBack, modifier = Modifier.heightIn(min = 48.dp)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back), tint = Slov.colors.text)
            }
        }
        TwoToneTitle(ink = ink, grey = grey)
        if (context != null) {
            Text(
                text = context,
                style = MaterialTheme.typography.bodyMedium,
                color = Slov.colors.textSecondary,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

/** Standard scrolling screen body: generous side padding and spacing. */
@Composable
fun SlovList(modifier: Modifier = Modifier, content: LazyListScope.() -> Unit) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

@Composable
fun LoadingBox(modifier: Modifier = Modifier) {
    val loadingText = stringResource(R.string.loading)
    Box(modifier = modifier.fillMaxWidth().padding(vertical = 48.dp), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(
            color = Slov.colors.textSecondary,
            modifier = Modifier.semantics { contentDescription = loadingText },
        )
    }
}

@Composable
fun ErrorBox(message: UiText, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    SlovCard(modifier = modifier) {
        Text(text = message.asString(), style = MaterialTheme.typography.bodyLarge, color = Slov.colors.danger)
        PillButton(text = stringResource(R.string.try_again), onClick = onRetry, kind = ButtonKind.QUIET, modifier = Modifier.padding(top = 12.dp))
    }
}

/** Adds list items for the loading, error or data state of a [Load]. */
fun <T> LazyListScope.loadContent(state: Load<T>, onRetry: () -> Unit, content: LazyListScope.(T) -> Unit) {
    when (state) {
        is Load.Loading -> item { LoadingBox() }
        is Load.Error -> item { ErrorBox(state.message, onRetry) }
        is Load.Data -> content(state.value)
    }
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = Slov.colors.textSecondary,
        modifier = modifier.semantics { heading() },
    )
}

/** Label on the left, value on the right. */
@Composable
fun InfoRow(label: String, value: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth().heightIn(min = 40.dp).padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = Slov.colors.textSecondary, modifier = Modifier.padding(end = 12.dp))
        Text(text = value, style = MaterialTheme.typography.titleSmall, color = Slov.colors.text)
    }
}
