package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import tech.krevo.app.data.staff.LibraryBook
import tech.krevo.app.data.staff.LibraryLoan
import tech.krevo.app.data.staff.StaffDates
import tech.krevo.app.design.Krevo

/**
 * The Library tab, for whoever holds the Library permission: how many books are out, what is overdue, and a searchable
 * catalogue that pages as you scroll. Issuing and returning are done on the web for now.
 */
@Composable
internal fun StaffLibraryScreen() {
    val staff = LocalStaff.current
    val c = Krevo.colors
    val scope = rememberCoroutineScope()
    val summary = rememberLoader { staff.repo.librarySummary() }
    var overdue by remember { mutableStateOf<List<LibraryLoan>>(emptyList()) }
    var query by rememberSaveable { mutableStateOf("") }
    var books by remember { mutableStateOf<List<LibraryBook>>(emptyList()) }
    var total by remember { mutableStateOf(0) }
    var state by remember { mutableStateOf<Ld<Unit>>(Ld.Loading) }
    var loadingMore by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()

    suspend fun reload() {
        try {
            val page = staff.repo.books(query, 0)
            books = page.items; total = page.total; state = Ld.Ok(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            if (books.isEmpty()) state = Ld.Failed(e.message ?: "Something went wrong. Please try again.")
        }
    }

    LaunchedEffect(Unit) {
        overdue = try { staff.repo.overdueLoans() } catch (e: CancellationException) { throw e } catch (_: Exception) { emptyList() }
    }
    // Wait a moment while typing, so each keystroke is not a request.
    LaunchedEffect(query) {
        if (query.isNotEmpty()) delay(300)
        reload()
    }
    // Load the next page when the last row comes into view.
    LaunchedEffect(listState, books.size, total) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }.collect { last ->
            if (!loadingMore && books.isNotEmpty() && books.size < total && last >= listState.layoutInfo.totalItemsCount - 2) {
                loadingMore = true
                try {
                    val page = staff.repo.books(query, books.size)
                    books = books + page.items.filter { n -> books.none { it.id == n.id } }
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) { }
                loadingMore = false
            }
        }
    }

    LazyColumn(Modifier.fillMaxSize(), state = listState, contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item {
            Loaded(summary, skeleton = { BlockSkeleton(84.dp) }) { s ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Count("Books", s.books, Modifier.weight(1f))
                    Count("On loan", s.onLoan, Modifier.weight(1f))
                    Count("Overdue", s.overdue, Modifier.weight(1f), if (s.overdue > 0) c.danger else c.text)
                }
            }
        }
        item { SearchField(query, { query = it }, "Search title, author or ISBN") }
        if (query.isEmpty() && overdue.isNotEmpty()) {
            item { SmallLabel("Overdue") }
            items(overdue, key = { "loan-" + it.id }) { loan ->
                PlainRow(
                    title = loan.title,
                    subtitle = "${loan.borrower} · ${loan.daysOverdue} ${if (loan.daysOverdue == 1) "day" else "days"} late · due ${StaffDates.date(loan.dueOn)}",
                )
            }
        }
        item { SmallLabel(if (query.isEmpty()) "Books" else "Results") }
        when (val s = state) {
            Ld.Loading -> item { StaffSkeleton(4) }
            is Ld.Failed -> item { ErrorNote(s.message) { scope.launch { reload() } } }
            is Ld.Ok -> {
                if (books.isEmpty()) item { EmptyNote("No books found.") }
                items(books, key = { it.id }) { b ->
                    PlainRow(
                        title = b.title, subtitle = listOfNotNull(b.author, b.category).filter { it.isNotEmpty() }.joinToString(" · "),
                        accessory = {
                            Text("${b.available}/${b.copiesTotal}", style = MaterialTheme.typography.titleSmall, color = if (b.available == 0) c.danger else c.text)
                        },
                    )
                }
                if (loadingMore) item { CircularProgressIndicator(Modifier.fillMaxWidth().padding(8.dp).size(24.dp), color = c.textTertiary, strokeWidth = 2.dp) }
            }
        }
    }
}

@Composable
private fun Count(label: String, value: Int, modifier: Modifier, tone: Color = Krevo.colors.text) {
    FlatCard(modifier) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary)
        Text(value.toString(), style = MaterialTheme.typography.titleLarge, color = tone)
    }
}
