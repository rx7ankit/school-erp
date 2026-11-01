package `in`.scool.app.domain

/** Everything a fee receipt prints. Built from a [Payment], its [Invoice] and the [Child]. */
data class Receipt(
    val schoolName: String,
    val schoolCity: String,
    val receiptNo: String,
    /** UTC ISO-8601 string, printed in IST. */
    val at: String,
    val studentName: String,
    val className: String,
    val scholarNo: String,
    val invoiceNo: String,
    val invoicePeriod: String,
    val amountPaise: Long,
    val mode: PaymentMode,
    val reference: String?,
    val receivedBy: String,
) {
    val amountInWords: String get() = AmountInWords.of(amountPaise)

    companion object {
        const val SCHOOL_NAME = "Rewa Public School"
        const val SCHOOL_CITY = "Rewa, Madhya Pradesh"

        fun of(child: Child, invoice: Invoice, payment: Payment) = Receipt(
            schoolName = SCHOOL_NAME, schoolCity = SCHOOL_CITY,
            receiptNo = payment.receiptNo, at = payment.at,
            studentName = child.name, className = child.className, scholarNo = child.scholarNo,
            invoiceNo = invoice.no, invoicePeriod = invoice.period,
            amountPaise = payment.amountPaise, mode = payment.mode, reference = payment.reference,
            receivedBy = payment.receivedBy,
        )
    }
}
