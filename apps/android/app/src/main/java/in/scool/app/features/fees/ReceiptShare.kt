package `in`.scool.app.features.fees

import android.app.Activity
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import `in`.scool.app.R
import `in`.scool.app.domain.Receipt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Builds the receipt PDF off the main thread, then opens the system share / save sheet for it. */
suspend fun shareReceipt(context: Context, receipt: Receipt) {
    val file = withContext(Dispatchers.IO) { ReceiptPdf.write(context, receipt) }
    sharePdf(
        context, file,
        subject = context.getString(R.string.fees_receipt_subject, receipt.receiptNo),
        chooserTitle = context.getString(R.string.fees_share_title),
    )
}

/** Shares a PDF from the cache folder through FileProvider (`cache/receipts/`, see res/xml/file_paths.xml). */
fun sharePdf(context: Context, file: File, subject: String, chooserTitle: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "application/pdf"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, subject)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val chooser = Intent.createChooser(send, chooserTitle)
    if (context !is Activity) chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(chooser)
}
