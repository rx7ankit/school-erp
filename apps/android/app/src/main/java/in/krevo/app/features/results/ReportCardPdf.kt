package `in`.krevo.app.features.results

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import `in`.krevo.app.R
import `in`.krevo.app.domain.Child
import `in`.krevo.app.domain.ExamDetail
import `in`.krevo.app.domain.Ist
import `in`.krevo.app.domain.Receipt
import `in`.krevo.app.domain.percent
import `in`.krevo.app.features.fees.sharePdf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * One-page A4 report card drawn with [PdfDocument]. Labels follow the app language (Hindi falls back to the system
 * Devanagari font); no rupee glyph.
 */
object ReportCardPdf {
    // A4 in PostScript points: 210 x 297 mm.
    private const val PAGE_W = 595
    private const val PAGE_H = 842
    private const val MARGIN = 40f

    /** The label / value rows above the table, in print order. */
    fun header(context: Context, child: Child, exam: ExamDetail): List<Pair<String, String>> = listOf(
        context.getString(R.string.pdf_exam) to exam.name,
        context.getString(R.string.pdf_student) to child.name,
        context.getString(R.string.profile_class) to child.className,
        context.getString(R.string.profile_scholar_no) to child.scholarNo,
    )

    fun attendanceLine(context: Context, exam: ExamDetail): String {
        val p = exam.attendancePercent ?: return context.getString(R.string.pdf_not_available)
        val from = exam.attendanceFrom
        val to = exam.attendanceTo
        if (from == null || to == null) return percent(p)
        return context.getString(R.string.pdf_attendance_period, percent(p), Ist.date(from), Ist.date(to))
    }

    fun write(context: Context, child: Child, exam: ExamDetail): File {
        val doc = PdfDocument()
        try {
            val page = doc.startPage(PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, 1).create())
            draw(context, page.canvas, child, exam)
            doc.finishPage(page)
            val dir = File(context.cacheDir, "receipts").apply { mkdirs() }
            val file = File(dir, "report-card-${exam.id}.pdf")
            file.outputStream().use { doc.writeTo(it) }
            return file
        } finally {
            doc.close()
        }
    }

    private fun draw(context: Context, canvas: Canvas, child: Child, exam: ExamDetail) {
        val width = PAGE_W - 2 * MARGIN
        val grey = Color.rgb(0x6E, 0x6E, 0x73)
        fun paint(size: Float, bold: Boolean = false, color: Int = Color.BLACK) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size
            this.color = color
            typeface = if (bold) Typeface.create(Typeface.DEFAULT, Typeface.BOLD) else Typeface.DEFAULT
        }
        fun text(s: String, x: Float, y: Float, w: Float, p: TextPaint): Float {
            val layout = StaticLayout.Builder.obtain(s, 0, s.length, p, w.toInt())
                .setAlignment(Layout.Alignment.ALIGN_NORMAL).build()
            canvas.save()
            canvas.translate(x, y)
            layout.draw(canvas)
            canvas.restore()
            return y + layout.height
        }
        fun rule(y: Float) = canvas.drawLine(MARGIN, y, PAGE_W - MARGIN, y, paint(1f, color = grey).apply { strokeWidth = 0.8f })

        var y = MARGIN
        y = text(Receipt.SCHOOL_NAME, MARGIN, y, width, paint(22f, bold = true))
        y = text(Receipt.SCHOOL_CITY, MARGIN, y + 2f, width, paint(12f, color = grey)) + 12f
        rule(y); y += 16f
        y = text(context.getString(R.string.pdf_report_title), MARGIN, y, width, paint(18f, bold = true)) + 14f

        val label = paint(11f, color = grey)
        val value = paint(13f)
        for ((k, v) in header(context, child, exam)) {
            val labelBottom = text(k, MARGIN, y + 1f, 90f, label)
            y = maxOf(labelBottom, text(v, MARGIN + 100f, y, width - 100f, value)) + 7f
        }
        y += 8f

        // Subject table: subject | marks | maximum | grade
        val colMarks = MARGIN + width * 0.52f
        val colMax = MARGIN + width * 0.70f
        val colGrade = MARGIN + width * 0.88f
        val head = paint(11f, bold = true, color = grey)
        text(context.getString(R.string.res_subject), MARGIN, y, 200f, head)
        text(context.getString(R.string.res_marks), colMarks, y, 60f, head)
        text(context.getString(R.string.pdf_maximum), colMax, y, 68f, head)
        text(context.getString(R.string.res_grade), colGrade, y, 50f, head)
        y += 18f
        rule(y); y += 8f
        val body = paint(13f)
        for (s in exam.subjects) {
            text(s.subject, MARGIN, y, colMarks - MARGIN - 8f, body)
            text(s.marks.toString(), colMarks, y, 60f, body)
            text(s.max.toString(), colMax, y, 60f, body)
            text(s.grade, colGrade, y, 50f, body)
            y += 24f
        }
        rule(y); y += 8f
        val bold = paint(13f, bold = true)
        text(context.getString(R.string.res_total), MARGIN, y, 200f, bold)
        text(exam.total.toString(), colMarks, y, 60f, bold)
        text(exam.maxTotal.toString(), colMax, y, 60f, bold)
        text(exam.grade, colGrade, y, 50f, bold)
        y += 30f

        val summary = listOf(
            context.getString(R.string.pdf_percentage) to percent(exam.percentage),
            context.getString(R.string.pdf_overall_grade) to exam.grade,
            context.getString(R.string.pdf_attendance) to attendanceLine(context, exam),
            context.getString(R.string.res_remark) to exam.remark,
        )
        for ((k, v) in summary) {
            val labelBottom = text(k, MARGIN, y + 1f, 120f, label)
            y = maxOf(labelBottom, text(v, MARGIN + 130f, y, width - 130f, value)) + 9f
        }

        text(context.getString(R.string.pdf_issued_on, Ist.date(Ist.today())), MARGIN, PAGE_H - MARGIN - 28f, width, paint(10.5f, color = grey))
        text(context.getString(R.string.pdf_report_footer), MARGIN, PAGE_H - MARGIN - 12f, width, paint(10.5f, color = grey))
    }
}

/** Builds the report card PDF off the main thread, then opens the system share sheet. */
suspend fun shareReportCard(context: Context, child: Child, exam: ExamDetail) {
    val file = withContext(Dispatchers.IO) { ReportCardPdf.write(context, child, exam) }
    sharePdf(
        context, file,
        subject = context.getString(R.string.res_report_subject, exam.name),
        chooserTitle = context.getString(R.string.res_report_share),
    )
}
