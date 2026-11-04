package tech.krevo.app.design

import androidx.compose.foundation.ExperimentalFoundationApi
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
import androidx.compose.foundation.lazy.LazyItemScope
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
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
import tech.krevo.app.R
import tech.krevo.app.domain.Load
import tech.krevo.app.domain.UiText

/** Two-tone heading: an ink phrase, then a grey phrase. */
@Composable
fun TwoToneTitle(ink: String, grey: String, modifier: Modifier = Modifier) {
    val c = Krevo.colors
    val text = buildAnnotatedString {
        withStyle(SpanStyle(color = c.text)) { append(ink) }
        append(" ")
        withStyle(SpanStyle(color = c.textTertiary)) { append(grey) }
    }
    Text(
        text = text,
        style = MaterialTheme.typography.headlineLarge,
        modifier = modifier.revealed().semantics { heading() },
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
    Column(modifier = modifier.fillMaxWidth().padding(top = 8.dp, bottom = 8.dp).revealed()) {
        CompositionLocalProvider(LocalRevealContent provides false) {
            if (onBack != null) {
                IconButton(onClick = onBack, modifier = Modifier.heightIn(min = 48.dp)) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back), tint = Krevo.colors.text)
                }
            }
            TwoToneTitle(ink = ink, grey = grey)
            if (context != null) {
                Text(
                    text = context,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Krevo.colors.textSecondary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/** Standard scrolling screen body: generous side padding and spacing. */
@Composable
fun KrevoList(modifier: Modifier = Modifier, content: LazyListScope.() -> Unit) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

/** Page-level loading placeholder (a generic skeleton). Kept under the old name so existing call sites compile. */
@Composable
fun LoadingBox(modifier: Modifier = Modifier) {
    SkeletonHost(modifier = modifier.padding(vertical = 8.dp)) { SkeletonList() }
}

@Composable
fun ErrorBox(message: UiText, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    KrevoCard(modifier = modifier) {
        Text(text = message.asString(), style = MaterialTheme.typography.bodyLarge, color = Krevo.colors.danger)
        PillButton(text = stringResource(R.string.try_again), onClick = onRetry, kind = ButtonKind.QUIET, modifier = Modifier.padding(top = 12.dp))
    }
}

/**
 * Adds list items for the loading, error or data state of a [Load].
 * Loading shows [skeleton] (a generic list by default; pass one that mirrors the screen's real layout).
 * Loaded items keep their card shapes still; only the content inside fades in and slides up, one after another.
 */
fun <T> LazyListScope.loadContent(
    state: Load<T>,
    onRetry: () -> Unit,
    skeleton: @Composable () -> Unit = { SkeletonList() },
    content: LazyListScope.(T) -> Unit,
) {
    when (state) {
        is Load.Loading -> item { SkeletonHost { skeleton() } }
        is Load.Error -> item { ErrorBox(state.message, onRetry) }
        is Load.Data -> content(AppearScope(this), state.value)
    }
}

/**
 * Forwards every item to [delegate]. The item itself is NOT animated: its content is composed with
 * [LocalRevealContent] = true and its running position in [LocalRevealIndex], so shared containers can reveal
 * only their inner content (card shapes stay put).
 */
@OptIn(ExperimentalFoundationApi::class)
private class AppearScope(private val delegate: LazyListScope) : LazyListScope {
    private var next = 0

    override fun item(key: Any?, contentType: Any?, content: @Composable LazyItemScope.() -> Unit) {
        val position = next++
        delegate.item(key, contentType) {
            val scope = this
            CompositionLocalProvider(LocalRevealContent provides true, LocalRevealIndex provides position) {
                scope.content()
            }
        }
    }

    override fun items(
        count: Int,
        key: ((index: Int) -> Any)?,
        contentType: (index: Int) -> Any?,
        itemContent: @Composable LazyItemScope.(index: Int) -> Unit,
    ) {
        val first = next
        next += count
        delegate.items(count, key, contentType) { index ->
            val scope = this
            CompositionLocalProvider(LocalRevealContent provides true, LocalRevealIndex provides first + index) {
                scope.itemContent(index)
            }
        }
    }

    @ExperimentalFoundationApi
    override fun stickyHeader(key: Any?, contentType: Any?, content: @Composable LazyItemScope.() -> Unit) {
        delegate.stickyHeader(key, contentType, content)
    }
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = Krevo.colors.textSecondary,
        modifier = modifier.revealed().semantics { heading() },
    )
}

/** Label on the left, value on the right. */
@Composable
fun InfoRow(label: String, value: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth().heightIn(min = 40.dp).padding(vertical = 6.dp).revealed(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary, modifier = Modifier.padding(end = 12.dp))
        Text(text = value, style = MaterialTheme.typography.titleSmall, color = Krevo.colors.text)
    }
}
