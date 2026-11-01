package `in`.scool.app.features.results

import `in`.scool.app.domain.ExamSummary
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import `in`.scool.app.design.ButtonKind
import `in`.scool.app.design.PillButton
import `in`.scool.app.domain.ExamDetail
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import androidx.compose.ui.res.stringResource
import `in`.scool.app.R
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.app.VmFactory
import `in`.scool.app.data.Repository
import `in`.scool.app.design.Chip
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.SectionLabel
import `in`.scool.app.design.loadContent
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.Load
import `in`.scool.app.domain.percent

@Composable
fun ResultsScreen(child: Child, repository: Repository, onOpen: (String) -> Unit) {
    val vm: ResultsViewModel = viewModel(
        key = "results-${child.id}",
        factory = VmFactory { ResultsViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()

    ScoolList {
        item { ScreenHeader(
                ink = stringResource(R.string.res_title_ink),
                grey = stringResource(R.string.res_title_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className),
            ) }
        loadContent(state, onRetry = vm::load) { exams ->
            if (exams.isEmpty()) {
                item { Text(stringResource(R.string.res_empty), style = MaterialTheme.typography.bodyLarge, color = Scool.colors.textSecondary) }
            }
            val (past, current) = exams.partition { it.isPastYear }
            current.forEach { exam -> item(key = exam.id) { ExamCard(exam, onOpen) } }
            // Older years stay available, read-only, grouped by academic year. Report cards can still be downloaded from the detail.
            if (past.isNotEmpty()) {
                item(key = "past-years") { SectionLabel(stringResource(R.string.res_past_years), modifier = Modifier.padding(top = 8.dp)) }
                past.groupBy { it.academicYear }.entries.sortedByDescending { it.key }.forEach { (year, list) ->
                    item(key = "year-$year") {
                        Text(stringResource(R.string.res_academic_year, year), style = MaterialTheme.typography.titleMedium, color = Scool.colors.text)
                    }
                    list.sortedByDescending { it.publishedAt }.forEach { exam -> item(key = exam.id) { ExamCard(exam, onOpen) } }
                }
            }
        }
    }
}

@Composable
private fun ExamCard(exam: ExamSummary, onOpen: (String) -> Unit) {
    ScoolCard(onClick = { onOpen(exam.id) }) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(exam.name, style = MaterialTheme.typography.titleLarge, color = Scool.colors.text)
                Text(
                    stringResource(R.string.res_published, Ist.dateOfInstant(exam.publishedAt)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Scool.colors.textSecondary,
                )
            }
            Text(percent(exam.percentage), style = MaterialTheme.typography.headlineMedium, color = Scool.colors.text)
        }
    }
}

@Composable
fun ResultDetailScreen(child: Child, examId: String, repository: Repository, onBack: () -> Unit) {
    val vm: ResultDetailViewModel = viewModel(
        key = "result-$examId",
        factory = VmFactory { ResultDetailViewModel(repository, examId) },
    )
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var building by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }

    // Builds the A4 report card off the main thread, then opens the share sheet.
    fun downloadReportCard(exam: ExamDetail) {
        building = true
        failed = false
        scope.launch {
            try {
                shareReportCard(context, child, exam)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                failed = true
            } finally {
                building = false
            }
        }
    }

    ScoolList {
        if (state !is Load.Data) item { ScreenHeader(ink = stringResource(R.string.res_detail_ink), grey = stringResource(R.string.res_detail_grey), onBack = onBack) }
        loadContent(state, onRetry = vm::load) { exam ->
            item { ScreenHeader(ink = "${exam.name}.", grey = stringResource(R.string.res_overall, percent(exam.percentage)), onBack = onBack) }
            item {
                ScoolCard {
                    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                        Text(stringResource(R.string.res_subject), Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = Scool.colors.textSecondary)
                        Text(stringResource(R.string.res_marks), Modifier.weight(0.6f), style = MaterialTheme.typography.labelMedium, color = Scool.colors.textSecondary)
                        Text(stringResource(R.string.res_grade), style = MaterialTheme.typography.labelMedium, color = Scool.colors.textSecondary)
                    }
                    exam.subjects.forEach { s ->
                        val rowDescription = stringResource(R.string.res_row_desc, s.subject, s.marks, s.max, s.grade)
                        HorizontalDivider(color = Scool.colors.separator)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp)
                                .semantics(mergeDescendants = true) {
                                    contentDescription = rowDescription
                                },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(s.subject, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge, color = Scool.colors.text)
                            Text("${s.marks} / ${s.max}", Modifier.weight(0.6f), style = MaterialTheme.typography.bodyLarge, color = Scool.colors.text)
                            Chip(s.grade)
                        }
                    }
                }
            }
            item {
                ScoolCard {
                    SectionLabel(stringResource(R.string.res_total))
                    Text(
                        "${exam.total} / ${exam.maxTotal}",
                        style = MaterialTheme.typography.headlineMedium,
                        color = Scool.colors.text,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(
                        stringResource(R.string.res_total_line, percent(exam.percentage), exam.grade),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Scool.colors.textSecondary,
                    )
                }
            }
            item {
                ScoolCard {
                    SectionLabel(stringResource(R.string.res_remark))
                    Text(exam.remark, style = MaterialTheme.typography.bodyLarge, color = Scool.colors.text, modifier = Modifier.padding(top = 4.dp))
                }
            }
            item {
                Text(
                    stringResource(R.string.res_published_at, Ist.dateTime(exam.publishedAt)),
                    style = MaterialTheme.typography.bodySmall,
                    color = Scool.colors.textSecondary,
                )
            }
            item {
                PillButton(
                    text = stringResource(R.string.res_download_report),
                    onClick = { downloadReportCard(exam) },
                    kind = ButtonKind.QUIET,
                    loading = building,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (failed) {
                item { Text(stringResource(R.string.res_report_error), style = MaterialTheme.typography.bodyMedium, color = Scool.colors.danger) }
            }
        }
    }
}
