package tech.krevo.app.features.staff

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.Radius
import java.text.NumberFormat
import java.util.Locale

// Small helpers shared by every staff screen, so each screen stays a plain composable plus one load call.
// They are plain Compose and do not use the parent app's string resources: the staff app is English only.

/** One screen's data: loading, failed with a message, or loaded. */
sealed interface Ld<out T> {
    data object Loading : Ld<Nothing>
    data class Failed(val message: String) : Ld<Nothing>
    data class Ok<T>(val value: T) : Ld<T>
}

val <T> Ld<T>.value: T? get() = (this as? Ld.Ok)?.value

/** Holds one screen's data. Keeps showing the old content while it refreshes; a failed refresh keeps what was on screen. */
class Loader<T>(private val work: suspend () -> T) {
    var state: Ld<T> by mutableStateOf(Ld.Loading)
        private set

    suspend fun run() {
        if (state !is Ld.Ok) state = Ld.Loading
        try {
            state = Ld.Ok(work())
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (state !is Ld.Ok) state = Ld.Failed(e.message ?: "Something went wrong. Please try again.")
        }
    }

    fun set(value: T) { state = Ld.Ok(value) }
}

/** Creates a [Loader] for [keys] and runs it right away. */
@Composable
fun <T> rememberLoader(vararg keys: Any?, work: suspend () -> T): Loader<T> {
    val loader = remember(*keys) { Loader(work) }
    LaunchedEffect(loader) { loader.run() }
    return loader
}

/** Like [rememberLoader], but keeps its content and loads again whenever [trigger] changes (so the screen never blinks). */
@Composable
fun <T> rememberReloading(trigger: Any?, work: suspend () -> T): Loader<T> {
    val loader = remember { Loader(work) }
    LaunchedEffect(trigger) { loader.run() }
    return loader
}

/** Skeleton while loading, a message with Try again on failure, else [content]. */
@Composable
fun <T> Loaded(loader: Loader<T>, skeleton: @Composable () -> Unit = { StaffSkeleton() }, content: @Composable ColumnScope.(T) -> Unit) {
    val scope = rememberCoroutineScope()
    when (val s = loader.state) {
        Ld.Loading -> skeleton()
        is Ld.Failed -> ErrorNote(s.message) { scope.launch { loader.run() } }
        is Ld.Ok -> Column(verticalArrangement = Arrangement.spacedBy(16.dp)) { content(s.value) }
    }
}

@Composable
fun StaffSkeleton(rows: Int = 3) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(rows) {
            Box(Modifier.fillMaxWidth().heightIn(min = 72.dp).clip(RoundedCornerShape(Radius.card)).background(Krevo.colors.card))
        }
    }
}

@Composable
fun ErrorNote(message: String, onRetry: () -> Unit) {
    val c = Krevo.colors
    Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(message, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
        TapSurface(onClick = onRetry, color = c.card, shape = CircleShape) {
            Text("Try again", style = MaterialTheme.typography.labelLarge, color = c.text, modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp))
        }
    }
}

@Composable
fun EmptyNote(text: String) {
    Text(
        text, style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary,
        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center,
    )
}

/** A page behind a bottom tab: scrolling, the standard 20dp gutters, no heading. Transparent, so the shared top glow shows through. */
@Composable
fun RootPage(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val scroll = rememberScrollState()
    Column(
        modifier = modifier.fillMaxSize().verticalScroll(scroll).padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        content = content,
    )
}

/** The back arrow (and an optional [action] on the right) and the title above a pushed page. The bottom bar is hidden while one is open. */
@Composable
fun PushedHeader(title: String, onBack: () -> Unit, modifier: Modifier = Modifier, action: (@Composable () -> Unit)? = null) {
    Column(modifier.fillMaxWidth().padding(horizontal = 12.dp).padding(top = 8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Krevo.colors.text)
            }
            action?.invoke()
        }
        if (title.isNotEmpty()) {
            Text(
                title, style = MaterialTheme.typography.headlineMedium, color = Krevo.colors.text,
                modifier = Modifier.padding(horizontal = 8.dp).semantics { heading() },
            )
        }
    }
}

/** A pushed screen: back arrow, title, then scrolling content. */
@Composable
fun PushedPage(title: String, onBack: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize()) {
        PushedHeader(title, onBack)
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            content = content,
        )
    }
}

/**
 * A plain list row with no box: an optional leading element, a title with a second line, something on the right, and
 * a thin line underneath. The quiet, document-like list used on Messages, Students, People and the class pages.
 */
@Composable
fun PlainRow(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    onClick: (() -> Unit)? = null,
    chevron: Boolean = onClick != null,
    divider: Boolean = true,
    accessory: (@Composable () -> Unit)? = null,
    leading: (@Composable () -> Unit)? = null,
) {
    val c = Krevo.colors
    Column(modifier.fillMaxWidth().then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)) {
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            leading?.invoke()
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (!subtitle.isNullOrEmpty()) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            accessory?.invoke()
            if (chevron) Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = c.textTertiary)
        }
        if (divider) HorizontalDivider(color = c.separator)
    }
}

/** Thin progress bar in the accent colour. */
@Composable
fun ThinProgress(fraction: Float, modifier: Modifier = Modifier, color: Color = Krevo.colors.accent, track: Color = Krevo.colors.fill) {
    Box(modifier.fillMaxWidth().height(6.dp).clip(CircleShape).background(track)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f).coerceAtLeast(0.02f)).height(6.dp).clip(CircleShape).background(color))
    }
}

/** A small orange count, for unread messages and pending requests. */
@Composable
fun CountBadge(count: Int) {
    Surface(shape = CircleShape, color = Krevo.colors.accent, tonalElevation = 0.dp, shadowElevation = 0.dp) {
        Text(
            count.toString(), style = MaterialTheme.typography.labelMedium, color = Krevo.colors.onAccent,
            modifier = Modifier.widthIn(min = 22.dp).padding(horizontal = 7.dp, vertical = 2.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

/** Springy shrink while pressed: every tappable surface answers the finger. */
@Composable
fun TapSurface(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = Krevo.colors.card,
    shape: androidx.compose.ui.graphics.Shape = RoundedCornerShape(Radius.card),
    enabled: Boolean = true,
    content: @Composable () -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.98f else 1f, spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium), label = "press")
    Surface(
        onClick = onClick, enabled = enabled, modifier = modifier.graphicsLayer { scaleX = scale; scaleY = scale },
        shape = shape, color = color, tonalElevation = 0.dp, shadowElevation = 0.dp, interactionSource = source,
    ) { content() }
}

/** Flat grey card that can be tapped. */
@Composable
fun TapCard(onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    TapSurface(onClick = onClick, modifier = modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), content = content)
    }
}

/** Flat grey card. */
@Composable
fun FlatCard(modifier: Modifier = Modifier, tint: Color = Krevo.colors.card, content: @Composable ColumnScope.() -> Unit) {
    Surface(modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(Radius.card), color = tint, tonalElevation = 0.dp, shadowElevation = 0.dp) {
        Column(Modifier.padding(16.dp), content = content)
    }
}

@Composable
fun Pill(text: String, color: Color = Krevo.colors.textSecondary, tint: Color = Krevo.colors.fill) {
    Surface(shape = CircleShape, color = tint, tonalElevation = 0.dp, shadowElevation = 0.dp) {
        Text(text, style = MaterialTheme.typography.labelMedium, color = color, modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp), maxLines = 1)
    }
}

@Composable
fun ToneChip(text: String, tone: Color) = Pill(text, color = tone, tint = tone.copy(alpha = 0.14f))

@Composable
fun SmallLabel(text: String) {
    Text(text.uppercase(), style = MaterialTheme.typography.labelMedium, color = Krevo.colors.textSecondary)
}

/** Round initials avatar tinted from the name, so the same person always has the same colour. */
@Composable
fun NameAvatar(name: String, size: androidx.compose.ui.unit.Dp = 40.dp) {
    val tints = listOf(Color(0xFFF26A1B), Color(0xFF2F6FED), Color(0xFF1E8E3E), Color(0xFF8E4BEC), Color(0xFFD6336C), Color(0xFF0E8A9B))
    val tint = tints[(name.fold(0) { acc, ch -> (acc * 31 + ch.code) and 0xFFFF }) % tints.size]
    val initials = name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.take(1).uppercase() }
    Box(Modifier.size(size).clip(CircleShape).background(tint.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
        Text(initials, style = MaterialTheme.typography.labelLarge, color = tint)
    }
}

/** Row of selectable chips (filters and segments). */
@Composable
fun <T> ChipRow(options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit) {
    val c = Krevo.colors
    val haptic = LocalHapticFeedback.current
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (id, title) ->
            val on = id == selected
            TapSurface(
                onClick = { haptic.select(); onSelect(id) }, color = if (on) c.solid else c.card, shape = CircleShape,
                modifier = Modifier.semantics { contentDescription = if (on) "$title, selected" else title },
            ) {
                Text(title, style = MaterialTheme.typography.labelLarge, color = if (on) c.onSolid else c.text, modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp), maxLines = 1)
            }
        }
    }
}

/** Plain rounded search field in the app's grey style. */
@Composable
fun SearchField(value: String, onChange: (String) -> Unit, prompt: String) {
    val c = Krevo.colors
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(CircleShape).background(c.card).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.Search, contentDescription = null, tint = c.textTertiary, modifier = Modifier.size(20.dp))
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text(prompt, style = MaterialTheme.typography.bodyLarge, color = c.textTertiary)
            BasicTextField(
                value = value, onValueChange = onChange, singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = c.text), cursorBrush = SolidColor(c.text),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (value.isNotEmpty()) {
            Icon(Icons.Filled.Clear, contentDescription = "Clear search", tint = c.textTertiary, modifier = Modifier.size(20.dp).clip(CircleShape).clickable { onChange("") })
        }
    }
}

/** A tappable phone number: opens the dialer (nothing is dialled until the person presses call). */
@Composable
fun CallButton(phone: String) {
    val context = LocalContext.current
    TapSurface(onClick = { dial(context, phone) }, color = Krevo.colors.fill, shape = CircleShape, modifier = Modifier.size(40.dp).semantics { contentDescription = "Call $phone" }) {
        Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Call, contentDescription = null, tint = Krevo.colors.text, modifier = Modifier.size(18.dp))
        }
    }
}

fun dial(context: Context, phone: String) {
    val number = phone.filter { it.isDigit() || it == '+' }
    runCatching { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

fun HapticFeedback.select() = performHapticFeedback(HapticFeedbackType.TextHandleMove)
fun HapticFeedback.success() = performHapticFeedback(HapticFeedbackType.LongPress)

/** "label ... value" row used in detail cards. */
@Composable
fun KeyValue(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary, modifier = Modifier.padding(end = 16.dp))
        Text(value, style = MaterialTheme.typography.titleSmall, color = Krevo.colors.text, textAlign = androidx.compose.ui.text.style.TextAlign.End, overflow = TextOverflow.Ellipsis)
    }
}

private val inr: NumberFormat = NumberFormat.getNumberInstance(Locale("en", "IN")).apply { maximumFractionDigits = 0 }

/** Money is integer paise. Shown as "₹1,50,000" with Indian digit grouping. */
fun rupees(paise: Long): String = "₹" + inr.format(paise / 100)

fun percent(v: Double?): String = v?.let { String.format(Locale.ENGLISH, "%.1f%%", it) } ?: "–"
