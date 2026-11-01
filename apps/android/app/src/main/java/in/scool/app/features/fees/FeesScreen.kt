package `in`.scool.app.features.fees

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import `in`.scool.app.app.VmFactory
import `in`.scool.app.data.Repository
import `in`.scool.app.design.InfoRow
import `in`.scool.app.design.Scool
import `in`.scool.app.design.ScoolCard
import `in`.scool.app.design.ScoolList
import `in`.scool.app.design.ScreenHeader
import `in`.scool.app.design.SectionLabel
import `in`.scool.app.design.StatusBadge
import `in`.scool.app.design.loadContent
import `in`.scool.app.domain.Child
import `in`.scool.app.domain.Invoice
import `in`.scool.app.domain.InvoiceStatus
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.Load
import `in`.scool.app.domain.Money

private const val PAY_AT_SCHOOL = "Pay at the school office."

@Composable
private fun statusColor(s: InvoiceStatus): Color = when (s) {
    InvoiceStatus.PAID -> Scool.colors.success
    InvoiceStatus.PARTIAL -> Scool.colors.warning
    InvoiceStatus.UNPAID -> Scool.colors.danger
}

private fun statusLabel(s: InvoiceStatus): String = when (s) {
    InvoiceStatus.PAID -> "Paid"
    InvoiceStatus.PARTIAL -> "Partly paid"
    InvoiceStatus.UNPAID -> "Unpaid"
}

@Composable
fun FeesScreen(child: Child, repository: Repository, onOpen: (String) -> Unit, onBack: () -> Unit) {
    val vm: FeesViewModel = viewModel(
        key = "fees-${child.id}",
        factory = VmFactory { FeesViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()

    ScoolList {
        item { ScreenHeader(ink = "Fees.", grey = "Invoices and receipts.", context = "${child.firstName} · Class ${child.className}", onBack = onBack) }
        loadContent(state, onRetry = vm::load) { invoices ->
            if (invoices.isEmpty()) {
                item { Text("No invoices yet.", style = MaterialTheme.typography.bodyLarge, color = Scool.colors.textSecondary) }
            }
            invoices.forEach { inv ->
                item(key = inv.id) { InvoiceCard(inv, onClick = { onOpen(inv.id) }) }
            }
            item { Text(PAY_AT_SCHOOL, style = MaterialTheme.typography.bodyMedium, color = Scool.colors.textSecondary) }
        }
    }
}

@Composable
private fun InvoiceCard(inv: Invoice, onClick: () -> Unit) {
    ScoolCard(onClick = onClick) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(inv.period, style = MaterialTheme.typography.titleLarge, color = Scool.colors.text)
            StatusBadge(statusLabel(inv.status), statusColor(inv.status))
        }
        Text(
            Money.format(inv.totalPaise),
            style = MaterialTheme.typography.headlineMedium,
            color = Scool.colors.text,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            "${inv.no} · due ${Ist.date(inv.dueOn)}",
            style = MaterialTheme.typography.bodyMedium,
            color = Scool.colors.textSecondary,
        )
    }
}

@Composable
fun InvoiceScreen(child: Child, invoiceId: String, repository: Repository, onBack: () -> Unit) {
    val vm: FeesViewModel = viewModel(
        key = "fees-${child.id}",
        factory = VmFactory { FeesViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()

    ScoolList {
        if (state !is Load.Data) item { ScreenHeader(ink = "Invoice.", grey = "One term.", onBack = onBack) }
        loadContent(state, onRetry = vm::load) { invoices ->
            val inv = invoices.firstOrNull { it.id == invoiceId }
            if (inv == null) {
                item { ScreenHeader(ink = "Invoice.", grey = "Not found.", onBack = onBack) }
            } else {
                item { ScreenHeader(ink = "${inv.period}.", grey = inv.no, onBack = onBack) }
                item {
                    ScoolCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            SectionLabel("Status")
                            StatusBadge(statusLabel(inv.status), statusColor(inv.status))
                        }
                        InfoRow("Due date", Ist.date(inv.dueOn))
                    }
                }
                item {
                    ScoolCard {
                        SectionLabel("Items")
                        inv.lines.forEach { InfoRow(it.title, Money.format(it.amountPaise)) }
                        HorizontalDivider(color = Scool.colors.separator, modifier = Modifier.padding(vertical = 4.dp))
                        InfoRow("Total", Money.format(inv.totalPaise))
                        InfoRow("Paid", Money.format(inv.paidPaise))
                        InfoRow("Balance", Money.format(inv.balancePaise))
                    }
                }
                item {
                    ScoolCard {
                        SectionLabel("Receipts")
                        if (inv.payments.isEmpty()) {
                            Text(
                                "No payments yet.",
                                style = MaterialTheme.typography.bodyLarge,
                                color = Scool.colors.textSecondary,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        inv.payments.forEachIndexed { i, p ->
                            if (i > 0) HorizontalDivider(color = Scool.colors.separator, modifier = Modifier.padding(vertical = 8.dp))
                            Column(modifier = Modifier.padding(top = 6.dp)) {
                                InfoRow(p.receiptNo, Money.format(p.amountPaise))
                                Text(
                                    "${p.mode.label} · ${Ist.dateTime(p.at)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Scool.colors.textSecondary,
                                )
                            }
                        }
                    }
                }
                item { Text(PAY_AT_SCHOOL, style = MaterialTheme.typography.bodyMedium, color = Scool.colors.textSecondary) }
            }
        }
    }
}
