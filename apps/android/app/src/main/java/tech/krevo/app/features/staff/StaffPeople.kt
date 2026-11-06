package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.AccessEditing
import tech.krevo.app.data.staff.AccessOptions
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoTextField
import tech.krevo.app.design.PillButton

/**
 * People & access: who is on staff, what each person can do, and logins. A page of its own, opened from the People card
 * on Home, only for whoever holds the People & access permission.
 */
@Composable
internal fun StaffPeopleScreen(onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    var query by rememberSaveable { mutableStateOf("") }
    var debounced by remember { mutableStateOf("") }
    LaunchedEffect(query) { if (query.isNotEmpty()) delay(300); debounced = query }
    val loader = rememberLoader(debounced) { staff.repo.staff(debounced) }

    Column(Modifier.fillMaxSize()) {
        PushedHeader("People & access", onBack, action = {
            Box(
                Modifier.size(44.dp).background(c.solid, CircleShape).clickable { staff.push(StaffDest.AddPerson) }.semantics { contentDescription = "Add a person" },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Filled.Add, contentDescription = null, tint = c.onSolid) }
        })
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { SearchField(query, { query = it }, "Search by name") }
            item {
                Loaded(loader) { rows ->
                    if (rows.isEmpty()) EmptyNote("No one found.")
                    Column {
                        rows.forEach { m ->
                            PlainRow(
                                title = m.name, subtitle = AccessEditing.summary(m.designation, m.permissions),
                                onClick = { staff.push(StaffDest.Person(m)) },
                                leading = { NameAvatar(m.name, 40.dp) },
                                accessory = { if (m.notSignedIn) ToneChip("Not signed in", c.warning) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** The permissions as switches, each with its plain-language description. */
@Composable
internal fun AccessSwitches(options: AccessOptions, selected: Set<String>, onChange: (Set<String>) -> Unit) {
    val c = Krevo.colors
    Column {
        options.permissions.forEachIndexed { i, p ->
            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(p.label, style = MaterialTheme.typography.titleMedium, color = c.text)
                    Text(p.description, style = MaterialTheme.typography.bodyMedium, color = c.textSecondary)
                }
                AccentSwitch(p.key in selected) { onChange(AccessEditing.toggle(selected, p.key, it)) }
            }
            if (i < options.permissions.lastIndex) HorizontalDivider(color = c.separator)
        }
    }
}

/** A new person: name, email, designation, their access as switches, and whether to email their login now. */
@Composable
internal fun StaffAddPersonScreen(onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val options = rememberLoader { staff.repo.accessOptions() }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var designation by remember { mutableStateOf("Teacher") }
    var permissions by remember { mutableStateOf<Set<String>>(emptySet()) }
    var sendLogin by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    PushedPage("Add a person", onBack) {
        KrevoTextField(name, { name = it }, label = "Name")
        KrevoTextField(email, { email = it }, label = "Email", keyboardType = KeyboardType.Email)
        KrevoTextField(designation, { designation = it }, label = "Designation")
        options.state.value?.let { o ->
            SmallLabel("Access")
            AccessSwitches(o, permissions) { permissions = it }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Email their login now", style = MaterialTheme.typography.bodyLarge, color = c.text)
            AccentSwitch(sendLogin) { sendLogin = it }
        }
        error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.danger) }
        PillButton(
            text = "Add", kind = ButtonKind.BRAND, loading = busy, modifier = Modifier.fillMaxWidth(),
            onClick = {
                val n = name.trim(); val e = email.trim()
                if (n.length < 2 || !e.contains("@")) { error = "Add a name and a valid email."; return@PillButton }
                scope.launch {
                    busy = true; error = null
                    try {
                        staff.repo.addStaff(n, e, designation.trim().ifEmpty { "Teacher" }, permissions.sorted(), sendLogin)
                        haptic.success(); staff.back()
                    } catch (ex: CancellationException) {
                        throw ex
                    } catch (ex: Exception) {
                        error = ex.message ?: "That could not be added. Try again."
                    }
                    busy = false
                }
            },
        )
    }
}

@Composable
internal fun AccentSwitch(checked: Boolean, onChange: (Boolean) -> Unit) {
    val c = Krevo.colors
    Switch(
        checked = checked, onCheckedChange = onChange,
        colors = SwitchDefaults.colors(checkedTrackColor = c.accent, checkedThumbColor = c.onAccent, uncheckedTrackColor = c.fill, uncheckedThumbColor = c.bg, uncheckedBorderColor = c.fill),
    )
}
