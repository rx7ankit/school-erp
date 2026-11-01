package `in`.scool.app.domain

import java.time.LocalDate

enum class InvoiceStatus { PAID, PARTIAL, UNPAID }

enum class PaymentMode(val label: String) {
    CASH("Cash"), CHEQUE("Cheque"), UPI("UPI"), BANK_TRANSFER("Bank transfer")
}

data class InvoiceLine(val title: String, val amountPaise: Long)

data class Payment(
    val receiptNo: String,
    val mode: PaymentMode,
    val amountPaise: Long,
    /** UTC ISO-8601 string. */
    val at: String,
)

data class Invoice(
    val id: String,
    val no: String,
    val period: String,
    val dueOn: LocalDate,
    val lines: List<InvoiceLine>,
    val payments: List<Payment>,
) {
    val totalPaise: Long get() = lines.sumOf { it.amountPaise }
    val paidPaise: Long get() = payments.sumOf { it.amountPaise }
    val balancePaise: Long get() = (totalPaise - paidPaise).coerceAtLeast(0L)
    val status: InvoiceStatus
        get() = when {
            paidPaise >= totalPaise -> InvoiceStatus.PAID
            paidPaise > 0 -> InvoiceStatus.PARTIAL
            else -> InvoiceStatus.UNPAID
        }
}
