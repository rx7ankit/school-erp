package tech.slov.app.features.fees

import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.res.stringResource
import tech.slov.app.R
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import tech.slov.app.design.ButtonKind
import tech.slov.app.design.PillButton
import tech.slov.app.domain.PaymentMode
import tech.slov.app.domain.Payment
import tech.slov.app.domain.Receipt
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
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
import tech.slov.app.app.VmFactory
import tech.slov.app.data.Repository
import tech.slov.app.design.InfoRow
import tech.slov.app.design.Slov
import tech.slov.app.design.SlovCard
import tech.slov.app.design.SlovList
import tech.slov.app.design.ScreenHeader
import tech.slov.app.design.SectionLabel
import tech.slov.app.design.StatusBadge
import tech.slov.app.design.loadContent
import tech.slov.app.domain.Child
import tech.slov.app.domain.Invoice
import tech.slov.app.domain.InvoiceStatus
import tech.slov.app.domain.Ist
import tech.slov.app.domain.Load
import tech.slov.app.domain.Money

@Composable
private fun statusColor(s: InvoiceStatus): Color = when (s) {
    InvoiceStatus.PAID -> Slov.colors.success
    InvoiceStatus.PARTIAL -> Slov.colors.warning
    InvoiceStatus.UNPAID -> Slov.colors.danger
}

@Composable
private fun statusLabel(s: InvoiceStatus): String = stringResource(
    when (s) {
        InvoiceStatus.PAID -> R.string.fees_paid
        InvoiceStatus.PARTIAL -> R.string.fees_partial
        InvoiceStatus.UNPAID -> R.string.fees_unpaid
    },
)

@Composable
private fun modeLabel(m: PaymentMode): String = stringResource(
    when (m) {
        PaymentMode.CASH -> R.string.pay_cash
        PaymentMode.CHEQUE -> R.string.pay_cheque
        PaymentMode.UPI -> R.string.pay_upi
        PaymentMode.BANK_TRANSFER -> R.string.pay_bank_transfer
    },
)

@Composable
fun FeesScreen(child: Child, repository: Repository, onOpen: (String) -> Unit, onBack: () -> Unit) {
    val vm: FeesViewModel = viewModel(
        key = "fees-${child.id}",
        factory = VmFactory { FeesViewModel(repository, child.id) },
    )
    val state by vm.state.collectAsStateWithLifecycle()

    SlovList {
        item { ScreenHeader(
                ink = stringResource(R.string.fees_title_ink),
                grey = stringResource(R.string.fees_title_grey),
                context = stringResource(R.string.child_context, child.firstName, child.className),
                onBack = onBack,
            ) }
        loadContent(state, onRetry = vm::load) { invoices ->
            if (invoices.isEmpty()) {
                item { Text(stringResource(R.string.fees_empty), style = MaterialTheme.typography.bodyLarge, color = Slov.colors.textSecondary) }
            }
            invoices.forEach { inv ->
                item(key = inv.id) { InvoiceCard(inv, onClick = { onOpen(inv.id) }) }
            }
            item { Text(stringResource(R.string.fees_pay_at_school), style = MaterialTheme.typography.bodyMedium, color = Slov.colors.textSecondary) }
        }
    }
}

@Composable
private fun InvoiceCard(inv: Invoice, onClick: () -> Unit) {
    SlovCard(onClick = onClick) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(inv.period, style = MaterialTheme.typography.titleLarge, color = Slov.colors.text)
            StatusBadge(statusLabel(inv.status), statusColor(inv.status))
        }
        Text(
            Money.format(inv.totalPaise),
            style = MaterialTheme.typography.headlineMedium,
            color = Slov.colors.text,
            modifier = Modifier.padding(top = 8.dp),
        )
        Text(
            stringResource(R.string.fees_invoice_line, inv.no, Ist.date(inv.dueOn)),
            style = MaterialTheme.typography.bodyMedium,
            color = Slov.colors.textSecondary,
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
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busyReceipt by remember { mutableStateOf<String?>(null) }
    var receiptFailed by remember { mutableStateOf(false) }

    // Builds the A5 PDF off the main thread, then opens the system share sheet.
    fun downloadReceipt(inv: Invoice, p: Payment) {
        busyReceipt = p.receiptNo
        receiptFailed = false
        scope.launch {
            try {
                shareReceipt(context, Receipt.of(child, inv, p))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                receiptFailed = true
            } finally {
                busyReceipt = null
            }
        }
    }

    SlovList {
        if (state !is Load.Data) item { ScreenHeader(ink = stringResource(R.string.fees_invoice_ink), grey = stringResource(R.string.fees_invoice_grey), onBack = onBack) }
        loadContent(state, onRetry = vm::load) { invoices ->
            val inv = invoices.firstOrNull { it.id == invoiceId }
            if (inv == null) {
                item { ScreenHeader(ink = stringResource(R.string.fees_invoice_ink), grey = stringResource(R.string.fees_not_found), onBack = onBack) }
            } else {
                item { ScreenHeader(ink = "${inv.period}.", grey = inv.no, onBack = onBack) }
                item {
                    SlovCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            SectionLabel(stringResource(R.string.fees_status))
                            StatusBadge(statusLabel(inv.status), statusColor(inv.status))
                        }
                        InfoRow(stringResource(R.string.fees_due_date), Ist.date(inv.dueOn))
                    }
                }
                item {
                    SlovCard {
                        SectionLabel(stringResource(R.string.fees_items))
                        inv.feeLines.forEach { InfoRow(it.title, Money.format(it.amountPaise)) }
                        // Concessions are negative lines: shown as "-₹1,000".
                        inv.discountLines.forEach { InfoRow(it.title, Money.format(it.amountPaise)) }
                        if (inv.lateFeePaise > 0) InfoRow(stringResource(R.string.fees_late_fee), Money.format(inv.lateFeePaise))
                        if (inv.previousDuesPaise > 0) InfoRow(stringResource(R.string.fees_previous_dues), Money.format(inv.previousDuesPaise))
                        HorizontalDivider(color = Slov.colors.separator, modifier = Modifier.padding(vertical = 4.dp))
                        InfoRow(stringResource(R.string.fees_total), Money.format(inv.totalPaise))
                        InfoRow(stringResource(R.string.fees_paid_row), Money.format(inv.paidPaise))
                        InfoRow(stringResource(R.string.fees_balance), Money.format(inv.balancePaise))
                    }
                }
                item {
                    SlovCard {
                        SectionLabel(stringResource(R.string.fees_payments))
                        if (inv.payments.isEmpty()) {
                            Text(
                                stringResource(R.string.fees_no_payments),
                                style = MaterialTheme.typography.bodyLarge,
                                color = Slov.colors.textSecondary,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        inv.payments.forEachIndexed { i, p ->
                            if (i > 0) HorizontalDivider(color = Slov.colors.separator, modifier = Modifier.padding(vertical = 8.dp))
                            Column(modifier = Modifier.padding(top = 6.dp)) {
                                val strike = if (p.isActive) TextDecoration.None else TextDecoration.LineThrough
                                val tone = if (p.isActive) Slov.colors.text else Slov.colors.textTertiary
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(p.receiptNo, style = MaterialTheme.typography.bodyMedium, color = tone, textDecoration = strike)
                                    Text(Money.format(p.amountPaise), style = MaterialTheme.typography.titleSmall, color = tone, textDecoration = strike)
                                }
                                Text(
                                    stringResource(R.string.fees_payment_line, modeLabel(p.mode), Ist.dateTime(p.at)),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Slov.colors.textSecondary,
                                    textDecoration = strike,
                                )
                                p.reference?.let {
                                    Text(it, style = MaterialTheme.typography.bodyMedium, color = Slov.colors.textSecondary)
                                }
                                Text(
                                    stringResource(R.string.fees_received_by, p.receivedBy),
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = Slov.colors.textSecondary,
                                )
                                if (p.isActive) {
                                    PillButton(
                                        text = stringResource(R.string.fees_download_receipt),
                                        onClick = { downloadReceipt(inv, p) },
                                        kind = ButtonKind.QUIET,
                                        enabled = busyReceipt == null,
                                        loading = busyReceipt == p.receiptNo,
                                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                                    )
                                } else {
                                    Text(
                                        stringResource(R.string.fees_cancelled),
                                        style = MaterialTheme.typography.titleSmall,
                                        color = Slov.colors.danger,
                                        modifier = Modifier.padding(top = 4.dp),
                                    )
                                }
                            }
                        }
                    }
                }
                if (receiptFailed) {
                    item { Text(stringResource(R.string.fees_receipt_error), style = MaterialTheme.typography.bodyMedium, color = Slov.colors.danger) }
                }
                item { Text(stringResource(R.string.fees_pay_at_school), style = MaterialTheme.typography.bodyMedium, color = Slov.colors.textSecondary) }
            }
        }
    }
}
