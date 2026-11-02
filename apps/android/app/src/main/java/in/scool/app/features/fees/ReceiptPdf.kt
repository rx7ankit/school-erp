package `in`.scool.app.features.fees

import android.content.Context
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import `in`.scool.app.R
import `in`.scool.app.domain.Ist
import `in`.scool.app.domain.Money
import `in`.scool.app.domain.PaymentMode
import `in`.scool.app.domain.Receipt
import java.io.File

/**
 * One-page A5 fee receipt drawn with [PdfDocument].
 *
 * The amount is written "Rs. 18,500": the PDF uses the platform default typeface and the Rupee sign
 * glyph is not guaranteed on every device. The rest of the app uses the proper symbol.
 *
 * Labels follow the app language (the [Context] passed in is the activity, so it already has the right resources).
 * Hindi text falls back to the system Devanagari font. The amount in words stays English (Indian grouping: lakh, crore).
 */
object ReceiptPdf {
    // A5 in PostScript points (1/72 inch): 148 x 210 mm.
    private const val PAGE_W = 420
    private const val PAGE_H = 595
    private const val MARGIN = 32f

    /** One printed line. [emphasis] prints the value bigger and bold (the amount). */
    class Row(val label: String, val value: String, val emphasis: Boolean = false)

    private fun modeLabel(context: Context, m: PaymentMode) = context.getString(
        when (m) {
            PaymentMode.CASH -> R.string.pay_cash
            PaymentMode.CHEQUE -> R.string.pay_cheque
            PaymentMode.UPI -> R.string.pay_upi
            PaymentMode.BANK_TRANSFER -> R.string.pay_bank_transfer
        },
    )

    /** "Rs. 18,500" (the Rupee sign is swapped out on purpose, see above). */
    fun amount(paise: Long): String = Money.format(paise).replace("₹", "Rs. ")

    /** The label / value rows in print order. Kept separate from drawing so it can be checked without a device. */
    fun rows(context: Context, r: Receipt): List<Row> = buildList {
        add(Row(context.getString(R.string.pdf_receipt_no), r.receiptNo))
        add(Row(context.getString(R.string.pdf_date_time), context.getString(R.string.pdf_ist_suffix, Ist.dateTime(r.at))))
        add(Row(context.getString(R.string.pdf_student), r.studentName))
        add(Row(context.getString(R.string.profile_class), r.className))
        add(Row(context.getString(R.string.profile_scholar_no), r.scholarNo))
        add(Row(context.getString(R.string.pdf_invoice), "${r.invoiceNo} (${r.invoicePeriod})"))
        add(Row(context.getString(R.string.pdf_amount), amount(r.amountPaise), emphasis = true))
        add(Row(context.getString(R.string.pdf_in_words), r.amountInWords))
        add(Row(context.getString(R.string.pdf_payment_mode), modeLabel(context, r.mode)))
        r.reference?.let { add(Row(context.getString(R.string.pdf_reference), it)) }
        add(Row(context.getString(R.string.pdf_received_by), r.receivedBy))
    }

    /** Writes the PDF into the cache folder (shared through FileProvider) and returns the file. */
    fun write(context: Context, receipt: Receipt): File {
        val doc = PdfDocument()
        try {
            val page = doc.startPage(PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, 1).create())
            draw(context, page.canvas, receipt)
            doc.finishPage(page)
            val dir = File(context.cacheDir, "receipts").apply { mkdirs() }
            val file = File(dir, "receipt-${receipt.receiptNo}.pdf")
            file.outputStream().use { doc.writeTo(it) }
            return file
        } finally {
            doc.close()
        }
    }

    private fun draw(context: Context, canvas: android.graphics.Canvas, r: Receipt) {
        val width = PAGE_W - 2 * MARGIN
        fun paint(size: Float, bold: Boolean = false, color: Int = Color.BLACK) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size
            this.color = color
            typeface = if (bold) Typeface.create(Typeface.DEFAULT, Typeface.BOLD) else Typeface.DEFAULT
        }
        val grey = Color.rgb(0x6E, 0x6E, 0x73)

        // Draws wrapped text at (x, y) and returns the y below it.
        fun text(s: String, x: Float, y: Float, w: Float, p: TextPaint): Float {
            val layout = StaticLayout.Builder.obtain(s, 0, s.length, p, w.toInt())
                .setAlignment(Layout.Alignment.ALIGN_NORMAL).build()
            canvas.save()
            canvas.translate(x, y)
            layout.draw(canvas)
            canvas.restore()
            return y + layout.height
        }

        var y = MARGIN
        y = text(r.schoolName, MARGIN, y, width, paint(18f, bold = true))
        y = text(r.schoolCity, MARGIN, y + 2f, width, paint(11f, color = grey))
        y += 12f
        canvas.drawLine(MARGIN, y, PAGE_W - MARGIN, y, paint(1f, color = grey).apply { strokeWidth = 0.8f })
        y += 14f
        y = text(context.getString(R.string.pdf_receipt_title), MARGIN, y, width, paint(16f, bold = true))
        y += 14f

        val labelW = 100f
        val label = paint(10.5f, color = grey)
        val value = paint(11.5f)
        val valueBold = paint(13f, bold = true)
        for (row in rows(context, r)) {
            // A long Hindi label can wrap to two lines: move down by whichever column is taller.
            val labelBottom = text(row.label, MARGIN, y + 1f, labelW, label)
            val valueBottom = text(row.value, MARGIN + labelW + 8f, y, width - labelW - 8f, if (row.emphasis) valueBold else value)
            y = maxOf(labelBottom, valueBottom) + 9f
        }

        val foot = paint(10f, color = grey)
        text(context.getString(R.string.pdf_receipt_footer), MARGIN, PAGE_H - MARGIN - 12f, width, foot)
    }
}
