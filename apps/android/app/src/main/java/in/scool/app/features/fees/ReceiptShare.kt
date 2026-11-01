package `in`.scool.app.features.fees

import android.app.Activity
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import `in`.scool.app.R
import `in`.scool.app.domain.Receipt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Builds the receipt PDF off the main thread, then opens the system share / save sheet for it. */
suspend fun shareReceipt(context: Context, receipt: Receipt) {
    val file = withContext(Dispatchers.IO) { ReceiptPdf.write(context, receipt) }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "application/pdf"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.fees_receipt_subject, receipt.receiptNo))
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val chooser = Intent.createChooser(send, context.getString(R.string.fees_share_title))
    if (context !is Activity) chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(chooser)
}
