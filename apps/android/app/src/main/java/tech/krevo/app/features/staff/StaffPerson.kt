package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.AccessEditing
import tech.krevo.app.data.staff.StaffMember
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.PillButton

/** One person: their access as switches (Save sits in the top bar), and a way to send their login. */
@Composable
internal fun StaffPersonScreen(member: StaffMember, onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val options = rememberLoader { staff.repo.accessOptions() }
    // What the server holds now; the switches are changes against it.
    var saved by remember { mutableStateOf(AccessEditing.known(member.permissions)) }
    var selected by remember { mutableStateOf(saved) }
    var busy by remember { mutableStateOf(false) }
        var message by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }

    fun fail(e: Exception, fallback: String) { failed = true; message = e.message ?: fallback }

    fun save() {
        scope.launch {
            busy = true; message = null
            try {
                staff.repo.setPermissions(member.id, selected.sorted())
                saved = selected; failed = false; message = "Saved."; haptic.success()
                // Their own access may have changed: reload who I am and what my app shows.
                if (member.id == staff.me.id) { staff.refreshMe(); staff.loadLayout() }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                fail(e, "That could not be saved. Try again.")
            }
            busy = false
        }
    }

    Column(Modifier.fillMaxSize()) {
        PushedHeader(member.name, onBack, action = {
            if (busy) {
                CircularProgressIndicator(Modifier.padding(end = 16.dp).size(22.dp), color = c.accent, strokeWidth = 2.dp)
            } else {
                val dirty = selected != saved
                Text(
                    "Save", style = MaterialTheme.typography.titleMedium, color = if (dirty) c.accent else c.textTertiary,
                    modifier = Modifier.clickable(enabled = dirty, onClick = ::save).padding(horizontal = 16.dp, vertical = 12.dp),
                )
            }
        })
        Column(
            Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                NameAvatar(member.name, 56.dp)
                Text(
                    listOf(member.designation, member.email).filter { it.isNotEmpty() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodyMedium, color = c.textSecondary,
                )
            }
            Loaded(options) { o ->
                SmallLabel("Access")
                AccessSwitches(o, selected) { selected = it; message = null }
            }
            message?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = if (failed) c.danger else c.success) }
        if (member.notSignedIn) {
            PillButton(
                text = "Send login by email", kind = ButtonKind.QUIET, enabled = !busy, modifier = Modifier.fillMaxWidth(),
                onClick = {
                    scope.launch {
                        failed = false
                        try {
                            staff.repo.sendLogin(member.id)
                            message = "Login sent."
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            fail(e, "The login could not be sent.")
                        }
                    }
                },
            )
        }
        }
    }
}
