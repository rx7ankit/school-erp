package tech.krevo.app.domain

import java.time.LocalDate

enum class InvoiceStatus { PAID, PARTIAL, UNPAID }

enum class PaymentMode { CASH, CHEQUE, UPI, BANK_TRANSFER, ONLINE }

data class InvoiceLine(val title: String, val amountPaise: Long)

enum class PaymentStatus { ACTIVE, CANCELLED }

data class Payment(
    val receiptNo: String,
    val mode: PaymentMode,
    val amountPaise: Long,
    /** UTC ISO-8601 string. */
    val at: String,
    /** Staff member who recorded the payment. */
    val receivedBy: String,
    /** Cheque number, UPI reference or transaction id. Null for cash. */
    val reference: String? = null,
    /** A payment cancelled by the school stays listed but no longer counts and has no receipt. */
    val status: PaymentStatus = PaymentStatus.ACTIVE,
) {
    val isActive: Boolean get() = status == PaymentStatus.ACTIVE
}

data class Invoice(
    val id: String,
    val no: String,
    val period: String,
    val dueOn: LocalDate,
    /** Fee heads (positive) and discounts / concessions (negative). */
    val lines: List<InvoiceLine>,
    val payments: List<Payment>,
    val lateFeePaise: Long = 0L,
    val previousDuesPaise: Long = 0L,
) {
    val feeLines: List<InvoiceLine> get() = lines.filter { it.amountPaise >= 0 }
    val discountLines: List<InvoiceLine> get() = lines.filter { it.amountPaise < 0 }
    /** Lines (discounts are negative) + late fee + previous dues. */
    val totalPaise: Long get() = lines.sumOf { it.amountPaise } + lateFeePaise + previousDuesPaise
    /** Only active payments count. */
    val paidPaise: Long get() = payments.filter { it.isActive }.sumOf { it.amountPaise }
    val balancePaise: Long get() = (totalPaise - paidPaise).coerceAtLeast(0L)
    val status: InvoiceStatus
        get() = when {
            paidPaise >= totalPaise -> InvoiceStatus.PAID
            paidPaise > 0 -> InvoiceStatus.PARTIAL
            else -> InvoiceStatus.UNPAID
        }
}
