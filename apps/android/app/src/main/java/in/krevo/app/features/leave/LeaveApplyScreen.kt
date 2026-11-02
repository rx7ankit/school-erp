package `in`.krevo.app.features.leave

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.krevo.app.R
import `in`.krevo.app.app.VmFactory
import `in`.krevo.app.data.Repository
import `in`.krevo.app.design.ButtonKind
import `in`.krevo.app.design.PillButton
import `in`.krevo.app.design.Krevo
import `in`.krevo.app.design.KrevoCard
import `in`.krevo.app.design.KrevoList
import `in`.krevo.app.design.KrevoTextField
import `in`.krevo.app.design.ScreenHeader
import `in`.krevo.app.design.SectionLabel
import `in`.krevo.app.design.SegmentedControl
import `in`.krevo.app.design.asString
import `in`.krevo.app.domain.Child
import `in`.krevo.app.domain.Ist
import `in`.krevo.app.domain.LEAVE_REASON_MAX
import `in`.krevo.app.domain.LeaveHalf
import java.time.LocalDate

private enum class Picking { FROM, TO }

@Composable
fun LeaveApplyScreen(child: Child, repository: Repository, onDone: () -> Unit, onBack: () -> Unit) {
    val vm: LeaveApplyViewModel = viewModel(
        key = "leave-apply-${child.id}",
        factory = VmFactory { LeaveApplyViewModel(repository, child.id) },
    )
    val form by vm.form.collectAsStateWithLifecycle()
    var picking by remember { mutableStateOf<Picking?>(null) }
    val today = Ist.today()

    KrevoList {
        item {
            ScreenHeader(
                ink = stringResource(R.string.leave_apply_ink),
                grey = stringResource(R.string.leave_apply_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className),
                onBack = onBack,
            )
        }
        item { DateCard(stringResource(R.string.leave_from), form.from, enabled = !form.submitting) { picking = Picking.FROM } }
        item { DateCard(stringResource(R.string.leave_to), form.to, enabled = !form.submitting) { picking = Picking.TO } }
        item {
            KrevoCard {
                SectionLabel(stringResource(R.string.leave_half_label))
                if (form.halfAllowed) {
                    val options = LeaveHalf.entries
                    SegmentedControl(
                        options = listOf(
                            stringResource(R.string.leave_half_none),
                            stringResource(R.string.leave_half_first_option),
                            stringResource(R.string.leave_half_second_option),
                        ),
                        selectedIndex = options.indexOf(form.half),
                        onSelect = { vm.setHalf(options[it]) },
                        modifier = Modifier.padding(top = 8.dp),
                    )
                } else {
                    Text(
                        stringResource(R.string.leave_half_hint),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Krevo.colors.textSecondary,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
        item {
            Column {
                KrevoTextField(
                    value = form.reason,
                    onValueChange = vm::setReason,
                    label = stringResource(R.string.leave_reason),
                    singleLine = false,
                    enabled = !form.submitting,
                )
                Text(
                    "${form.reason.length}/$LEAVE_REASON_MAX",
                    style = MaterialTheme.typography.bodySmall,
                    color = Krevo.colors.textSecondary,
                    textAlign = TextAlign.End,
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                )
            }
        }
        form.error?.let { e ->
            item { Text(e.asString(), style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.danger) }
        }
        item {
            PillButton(
                text = stringResource(R.string.leave_submit),
                onClick = { vm.submit(onDone) },
                kind = ButtonKind.BRAND,
                enabled = form.canSubmit,
                loading = form.submitting,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    when (picking) {
        Picking.FROM -> IstDatePickerDialog(initial = form.from, min = today, onPick = { vm.setFrom(it) }, onDismiss = { picking = null })
        Picking.TO -> IstDatePickerDialog(initial = form.to, min = form.from, onPick = { vm.setTo(it) }, onDismiss = { picking = null })
        null -> Unit
    }
}

@Composable
private fun DateCard(label: String, date: LocalDate, enabled: Boolean, onClick: () -> Unit) {
    KrevoCard(onClick = if (enabled) onClick else null) {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
        ) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.textSecondary)
            Text(Ist.date(date), style = MaterialTheme.typography.titleMedium, color = Krevo.colors.text)
        }
    }
}

/**
 * Material 3 date picker on plain calendar dates: the picker hands back UTC-midnight millis of the tapped day,
 * which [Ist.fromPickerMillis] turns back into that same school date (no device-zone shift). Days before [min] are disabled.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun IstDatePickerDialog(initial: LocalDate, min: LocalDate, onPick: (LocalDate) -> Unit, onDismiss: () -> Unit) {
    val c = Krevo.colors
    val state = rememberDatePickerState(
        initialSelectedDateMillis = Ist.toPickerMillis(initial),
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long): Boolean = !Ist.fromPickerMillis(utcTimeMillis).isBefore(min)
            override fun isSelectableYear(year: Int): Boolean = year >= min.year
        },
    )
    val colors = DatePickerDefaults.colors(
        containerColor = c.bg,
        selectedDayContainerColor = c.accent,
        selectedDayContentColor = c.onAccent,
        todayDateBorderColor = c.accent,
        todayContentColor = c.text,
    )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    state.selectedDateMillis?.let { onPick(Ist.fromPickerMillis(it)) }
                    onDismiss()
                },
                modifier = Modifier.heightIn(min = 48.dp),
            ) { Text(stringResource(R.string.ok), color = c.text) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, modifier = Modifier.heightIn(min = 48.dp)) {
                Text(stringResource(R.string.cancel), color = c.text)
            }
        },
        colors = colors,
        tonalElevation = 0.dp,
    ) {
        DatePicker(state = state, colors = colors)
    }
}
