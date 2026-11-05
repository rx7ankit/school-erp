package tech.krevo.app.features.staff

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.data.staff.StudentDetail
import tech.krevo.app.data.staff.StudentItem
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.TwoToneTitle

@Composable
internal fun StaffStudentsScreen() {
    val staff = LocalStaff.current
    var opened by remember { mutableStateOf<StudentItem?>(null) }
    BackHandler(enabled = opened != null) { opened = null }
    opened?.let { StudentDetailScreen(it, onBack = { opened = null }); return }

    val c = Krevo.colors
    var query by rememberSaveable { mutableStateOf("") }
    var classId by rememberSaveable { mutableStateOf("") }
    var items by remember { mutableStateOf<List<StudentItem>>(emptyList()) }
    var total by remember { mutableStateOf(0) }
    var state by remember { mutableStateOf<Ld<Unit>>(Ld.Loading) }
    var loadingMore by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    suspend fun reload() {
        if (items.isEmpty()) state = Ld.Loading
        try {
            val page = staff.repo.students(query, classId.ifEmpty { null }, 0)
            items = page.items; total = page.total; state = Ld.Ok(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (items.isEmpty()) state = Ld.Failed(e.message ?: "Something went wrong. Please try again.")
        }
    }

    // Wait a moment while typing, so each keystroke is not a request.
    LaunchedEffect(query, classId) {
        if (query.isNotEmpty()) delay(300)
        reload()
    }

    // Load the next page when the last row comes into view.
    LaunchedEffect(listState, items.size, total) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }.collect { last ->
            if (!loadingMore && items.isNotEmpty() && items.size < total && last >= items.size - 1) {
                loadingMore = true
                try {
                    val page = staff.repo.students(query, classId.ifEmpty { null }, items.size)
                    items = items + page.items.filter { n -> items.none { it.id == n.id } }
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) { }
                loadingMore = false
            }
        }
    }

    LazyColumn(
        Modifier.fillMaxSize(), state = listState, contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { TwoToneTitle(ink = "Students.", grey = if (total > 0) "$total in all." else "") }
        item { SearchField(query, { query = it }, "Search name or scholar number") }
        if (staff.classes.size > 1) {
            item { ChipRow(listOf("" to "All") + staff.classes.map { it.id to it.label }, classId) { classId = it } }
        }
        when (val s = state) {
            Ld.Loading -> item { StaffSkeleton(5) }
            is Ld.Failed -> item { ErrorNote(s.message) { scope.launch { reload() } } }
            is Ld.Ok -> {
                if (items.isEmpty()) item { EmptyNote("No students found.") }
                items(items, key = { it.id }) { st ->
                    TapCard(onClick = { opened = st }) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            NameAvatar(st.name, 40.dp)
                            Column(Modifier.weight(1f)) {
                                Text(st.name, style = MaterialTheme.typography.titleMedium, color = c.text, maxLines = 1)
                                Text(
                                    listOfNotNull(st.classLabel?.let { "Class $it" }, st.rollNo?.let { "Roll $it" }).joinToString(" · "),
                                    style = MaterialTheme.typography.bodyMedium, color = c.textSecondary,
                                )
                            }
                            Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = c.textTertiary)
                        }
                    }
                }
                if (loadingMore) item { CircularProgressIndicator(Modifier.fillMaxWidth().padding(8.dp).size(24.dp), color = c.textTertiary, strokeWidth = 2.dp) }
            }
        }
    }
}

@Composable
private fun StudentDetailScreen(item: StudentItem, onBack: () -> Unit) {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val loader = rememberLoader(item.id) { staff.repo.student(item.id) }
    StaffPage(ink = item.name, grey = "") {
        Row {
            Icon(Icons.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(40.dp).clip(CircleShape).clickable(onClick = onBack).padding(8.dp))
        }
        Text(
            listOfNotNull(item.classLabel?.let { "Class $it" }, item.scholarNo).joinToString(" · "),
            style = MaterialTheme.typography.bodyMedium, color = c.textSecondary,
        )
        Loaded(loader) { d -> DetailBody(d) }
    }
    BackHandler(onBack = onBack)
}

@Composable
private fun androidx.compose.foundation.layout.ColumnScope.DetailBody(d: StudentDetail) {
    val c = Krevo.colors
    SmallLabel("Student")
    FlatCard {
        KeyValue("Scholar no.", d.scholarNo)
        d.rollNo?.let { KeyValue("Roll no.", it.toString()) }
        d.gender?.let { KeyValue("Gender", it.replaceFirstChar { ch -> ch.uppercase() }) }
        d.dob?.let { KeyValue("Born", StaffDates.date(it)) }
        d.bloodGroup?.let { KeyValue("Blood group", it) }
        d.category?.let { KeyValue("Category", it) }
        d.admittedOn?.let { KeyValue("Admitted", StaffDates.date(it)) }
    }
    d.address?.takeIf { it.isNotBlank() }?.let { FlatCard { KeyValue("Address", it) } }
    d.medicalNotes?.takeIf { it.isNotBlank() }?.let { FlatCard { KeyValue("Medical notes", it) } }

    SmallLabel("Family")
    d.guardians.forEach { g ->
        FlatCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(g.name, style = MaterialTheme.typography.titleMedium, color = c.text)
                    Text(
                        g.relation.replaceFirstChar { it.uppercase() } + (if (g.isPrimary) " · Primary" else "") + (g.occupation?.let { " · $it" } ?: ""),
                        style = MaterialTheme.typography.bodyMedium, color = c.textSecondary,
                    )
                    g.phone?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = c.text) }
                }
                g.phone?.let { CallButton(it) }
            }
        }
    }
    if (d.emergencyName != null && d.emergencyPhone != null) {
        FlatCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    SmallLabel("Emergency contact")
                    Text(d.emergencyName, style = MaterialTheme.typography.titleMedium, color = c.text)
                }
                CallButton(d.emergencyPhone)
            }
        }
    }
}
