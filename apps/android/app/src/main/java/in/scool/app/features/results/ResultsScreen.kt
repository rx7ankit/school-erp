package `in`.scool.app.features.results

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
        item { ScreenHeader(ink = "Results.", grey = "Every published exam.", context = "${child.firstName} · Class ${child.className}") }
        loadContent(state, onRetry = vm::load) { exams ->
            if (exams.isEmpty()) {
                item { Text("No results published yet.", style = MaterialTheme.typography.bodyLarge, color = Scool.colors.textSecondary) }
            }
            exams.forEach { exam ->
                item(key = exam.id) {
                    ScoolCard(onClick = { onOpen(exam.id) }) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(exam.name, style = MaterialTheme.typography.titleLarge, color = Scool.colors.text)
                                Text(
                                    "Published ${Ist.dateOfInstant(exam.publishedAt)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Scool.colors.textSecondary,
                                )
                            }
                            Text(percent(exam.percentage), style = MaterialTheme.typography.headlineMedium, color = Scool.colors.text)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ResultDetailScreen(examId: String, repository: Repository, onBack: () -> Unit) {
    val vm: ResultDetailViewModel = viewModel(
        key = "result-$examId",
        factory = VmFactory { ResultDetailViewModel(repository, examId) },
    )
    val state by vm.state.collectAsStateWithLifecycle()

    ScoolList {
        if (state !is Load.Data) item { ScreenHeader(ink = "Result.", grey = "One exam.", onBack = onBack) }
        loadContent(state, onRetry = vm::load) { exam ->
            item { ScreenHeader(ink = "${exam.name}.", grey = "${percent(exam.percentage)} overall.", onBack = onBack) }
            item {
                ScoolCard {
                    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
                        Text("Subject", Modifier.weight(1f), style = MaterialTheme.typography.labelMedium, color = Scool.colors.textSecondary)
                        Text("Marks", Modifier.weight(0.6f), style = MaterialTheme.typography.labelMedium, color = Scool.colors.textSecondary)
                        Text("Grade", style = MaterialTheme.typography.labelMedium, color = Scool.colors.textSecondary)
                    }
                    exam.subjects.forEach { s ->
                        HorizontalDivider(color = Scool.colors.separator)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp)
                                .semantics(mergeDescendants = true) {
                                    contentDescription = "${s.subject}, ${s.marks} out of ${s.max}, grade ${s.grade}"
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
                    SectionLabel("Total")
                    Text(
                        "${exam.total} / ${exam.maxTotal}",
                        style = MaterialTheme.typography.headlineMedium,
                        color = Scool.colors.text,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(
                        "${percent(exam.percentage)} · Grade ${exam.grade}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Scool.colors.textSecondary,
                    )
                }
            }
            item {
                ScoolCard {
                    SectionLabel("Class teacher remark")
                    Text(exam.remark, style = MaterialTheme.typography.bodyLarge, color = Scool.colors.text, modifier = Modifier.padding(top = 4.dp))
                }
            }
            item {
                Text(
                    "Published ${Ist.dateTime(exam.publishedAt)} IST",
                    style = MaterialTheme.typography.bodySmall,
                    color = Scool.colors.textSecondary,
                )
            }
        }
    }
}
