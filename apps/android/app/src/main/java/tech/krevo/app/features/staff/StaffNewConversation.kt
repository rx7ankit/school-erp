package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.StudentItem
import tech.krevo.app.data.staff.threadSubjectId
import tech.krevo.app.design.Krevo

/**
 * Starts a conversation with a student's parents: pick the student from those in my classes, and the chat opens. The
 * conversation is under my subject for that class, or "class teacher" when I am the child's class teacher. The API
 * refuses a child I am not assigned to, and its message is shown as is.
 */
@Composable
internal fun StaffNewConversationScreen(onBack: () -> Unit) {
    val staff = LocalStaff.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun start(student: StudentItem) {
        if (busy) return
        scope.launch {
            busy = true; error = null
            try {
                val id = staff.repo.openThread(student.id, threadSubjectId(staff.me.assignments, student.classId))
                staff.replaceTop(StaffDest.Chat(id))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                error = e.message ?: "The conversation could not be started. Try again."
            }
            busy = false
        }
    }

    Column(Modifier.fillMaxSize()) {
        PushedHeader("New conversation", onBack)
        Text(
            if (busy) "Opening…" else error ?: "Choose a student to write to their parents.",
            style = MaterialTheme.typography.bodyMedium, color = if (error != null && !busy) Krevo.colors.danger else Krevo.colors.textSecondary,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        )
        StudentList(onPick = ::start)
    }
}
