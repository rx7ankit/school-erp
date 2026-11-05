package tech.krevo.app.features.results

import tech.krevo.app.design.ResultsSkeleton
import tech.krevo.app.design.ResultDetailSkeleton
import tech.krevo.app.domain.ExamSummary
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import tech.krevo.app.design.ButtonKind
import tech.krevo.app.design.PillButton
import tech.krevo.app.domain.ExamDetail
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import androidx.compose.ui.res.stringResource
import tech.krevo.app.R
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
import tech.krevo.app.app.VmFactory
import tech.krevo.app.data.Repository
import tech.krevo.app.design.Chip
import tech.krevo.app.design.Krevo
import tech.krevo.app.design.KrevoCard
import tech.krevo.app.design.KrevoList
import tech.krevo.app.design.ScreenHeader
import tech.krevo.app.design.SectionLabel
import tech.krevo.app.design.loadContent
import tech.krevo.app.domain.Child
import tech.krevo.app.domain.Ist
import tech.krevo.app.domain.Load
import tech.krevo.app.domain.percent

@Composable
fun ResultsScreen(child: Child, repository: Repository, onOpen: (String) -> Unit) {
    val vm: ResultsViewModel = viewModel(
        key = "results-${child.id}",
        factory = VmFactory { ResultsViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()

    KrevoList {
        item { ScreenHeader(
                ink = stringResource(R.string.res_title_ink),
                grey = stringResource(R.string.res_title_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className),
            ) }
        loadContent(state, onRetry = vm::load, skeleton = { ResultsSkeleton() }) { exams ->
            if (exams.isEmpty()) {
                item { Text(stringResource(R.string.res_empty), style = MaterialTheme.typography.bodyLarge, color = Krevo.colors.textSecondary) }
            }
            val (past, current) = exams.partition { it.isPastYear }
            current.forEach { exam -> item(key = exam.id) { ExamCard(exam, onOpen) } }
            // Older years stay available, read-only, grouped by academic year. Report cards can still be downloaded from the detail.
            if (past.isNotEmpty()) {
                item(key = "past-years") { SectionLabel(stringResource(R.string.res_past_years), modifier = Modifier.padding(top = 8.dp)) }
                past.groupBy { it.academicYear }.entries.sortedByDescending { it.key }.forEach { (year, list) ->
                    item(key = "year-$year") {
                        Text(stringResource(R.string.res_academic_year, year), style = MaterialTheme.typography.titleMedium, color = Krevo.colors.text)
                    }
                    list.sortedByDescending { it.publishedAt }.forEach { exam -> item(key = exam.id) { ExamCard(exam, onOpen) } }
                }
            }
        }
    }
}

@Composable
private fun ExamCard(exam: ExamSummary, onOpen: (String) -> Unit) {
    KrevoCard(onClick = { onOpen(exam.id) }) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(exam.name, style = MaterialTheme.typography.titleLarge, color = Krevo.colors.text)
                Text(
                    stringResource(R.string.res_published, Ist.dateOfInstant(exam.publishedAt)),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Krevo.colors.textSecondary,
                )
            }
            Text(percent(exam.percentage), style = MaterialTheme.typography.headlineMedium, color = Krevo.colors.text)
        }
    }
}

@Composable
fun ResultDetailScreen(child: Child, examId: String, repository: Repository, onBack: () -> Unit) {
    val vm: ResultDetailViewModel = viewModel(
        key = "result-$examId",
        factory = VmFactory { ResultDetailViewModel(repository, child.id, examId) },
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

    KrevoList {
        if (state !is Load.Data) item { ScreenHeader(ink = stringResource(R.string.res_detail_ink), grey = stringResource(R.string.res_detail_grey), onBack = onBack) }
        loadContent(state, onRetry = vm::load, skeleton = { ResultDetailSkeleton() }) { exam ->
            item { ScreenHeader(ink = exam.name, grey = "", onBack = onBack) }
            item {
                KrevoCard {
                    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                        Text(stringResource(R.string.res_subject), Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = Krevo.colors.textSecondary)
                        Text(stringResource(R.string.res_marks), Modifier.weight(0.6f), style = MaterialTheme.typography.labelMedium, color = Krevo.colors.textSecondary)
                        Text(stringResource(R.string.res_grade), style = MaterialTheme.typography.labelMedium, color = Krevo.colors.textSecondary)
                    }
                    exam.subjects.forEach { s ->
                        val rowDescription = stringResource(R.string.res_row_desc, s.subject, s.marksText, s.max, s.grade)
                        HorizontalDivider(color = Krevo.colors.separator)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp)
                                .semantics(mergeDescendants = true) {
                                    contentDescription = rowDescription
                                },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(s.subject, Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge, color = Krevo.colors.text)
                            Text("${s.marksText} / ${s.max}", Modifier.weight(0.6f), style = MaterialTheme.typography.bodyLarge, color = Krevo.colors.text)
                            Chip(s.grade)
                        }
                    }
                }
            }
            item {
                KrevoCard {
                    SectionLabel(stringResource(R.string.res_total))
                    Text(
                        "${exam.totalText} / ${exam.maxTotal}",
                        style = MaterialTheme.typography.headlineMedium,
                        color = Krevo.colors.text,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(
                        stringResource(R.string.res_total_line, percent(exam.percentage), exam.grade),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Krevo.colors.textSecondary,
                    )
                }
            }
            // Only when the class teacher actually wrote something.
            if (exam.remark.isNotBlank()) item {
                KrevoCard {
                    SectionLabel(stringResource(R.string.res_remark))
                    Text(exam.remark, style = MaterialTheme.typography.bodyLarge, color = Krevo.colors.text, modifier = Modifier.padding(top = 4.dp))
                }
            }
            item {
                Text(
                    stringResource(R.string.res_published_at, Ist.dateTime(exam.publishedAt)),
                    style = MaterialTheme.typography.bodySmall,
                    color = Krevo.colors.textSecondary,
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
                item { Text(stringResource(R.string.res_report_error), style = MaterialTheme.typography.bodyMedium, color = Krevo.colors.danger) }
            }
        }
    }
}
