package tech.krevo.app.features.language

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import tech.krevo.app.R
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoCard
import tech.krevo.app.domain.AppLanguage

/** The language's own name. The same in every app language, so each person can always find theirs. */
@Composable
private fun AppLanguage.nativeName(): String = stringResource(
    when (this) {
        AppLanguage.EN -> R.string.lang_name_en
        AppLanguage.HI -> R.string.lang_name_hi
    },
)

@Composable
private fun AppLanguage.shortName(): String = stringResource(
    when (this) {
        AppLanguage.EN -> R.string.lang_short_en
        AppLanguage.HI -> R.string.lang_short_hi
    },
)

/**
 * First launch only: a bilingual heading and two big buttons. Shown at the top of the first screen
 * until the parent picks a language once.
 */
@Composable
fun LanguageChooser(onChoose: (AppLanguage) -> Unit, modifier: Modifier = Modifier) {
    val c = Krevo.colors
    KrevoCard(modifier = modifier) {
        Text(
            text = stringResource(R.string.language_choose_title),
            style = MaterialTheme.typography.titleLarge,
            color = c.text,
            modifier = Modifier.semantics { heading() },
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AppLanguage.entries.forEach { language ->
                Surface(
                    onClick = { onChoose(language) },
                    modifier = Modifier.weight(1f),
                    shape = CircleShape,
                    color = c.solid,
                    contentColor = c.onSolid,
                    tonalElevation = 0.dp,
                    shadowElevation = 0.dp,
                ) {
                    Box(
                        modifier = Modifier.heightIn(min = 64.dp).padding(horizontal = 12.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = language.nativeName(),
                            style = MaterialTheme.typography.titleMedium,
                            color = c.onSolid,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}

/**
 * Compact segmented switch "EN | हि" for the top of Home, Login and Settings. Each segment is at least 48dp wide and tall
 * (44dp plus the 2dp frame), and TalkBack reads the full language name instead of the short label.
 */
@Composable
fun LanguageSwitch(selected: AppLanguage, onSelect: (AppLanguage) -> Unit, modifier: Modifier = Modifier) {
    val c = Krevo.colors
    val groupLabel = stringResource(R.string.language_label)
    Surface(
        modifier = modifier.semantics { contentDescription = groupLabel },
        shape = CircleShape,
        color = c.card,
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
    ) {
        Row(modifier = Modifier.padding(2.dp).selectableGroup()) {
            AppLanguage.entries.forEach { language ->
                val isSelected = language == selected
                val name = language.nativeName()
                Surface(
                    modifier = Modifier
                        .widthIn(min = 48.dp)
                        .heightIn(min = 44.dp)
                        .selectable(selected = isSelected, role = Role.RadioButton, onClick = { onSelect(language) }),
                    shape = CircleShape,
                    color = if (isSelected) c.solid else c.card,
                    tonalElevation = 0.dp,
                    shadowElevation = 0.dp,
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.padding(horizontal = 12.dp)) {
                        Text(
                            text = language.shortName(),
                            style = MaterialTheme.typography.labelLarge,
                            color = if (isSelected) c.onSolid else c.text,
                            modifier = Modifier.clearAndSetSemantics { contentDescription = name },
                        )
                    }
                }
            }
        }
    }
}
