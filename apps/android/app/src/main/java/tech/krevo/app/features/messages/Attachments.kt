package tech.krevo.app.features.messages

import android.content.ContentResolver
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import tech.krevo.app.R
import tech.krevo.app.design.Krevo
import tech.krevo.app.domain.MessageAttachment
import tech.krevo.app.domain.UiText
import java.io.ByteArrayOutputStream
import java.net.URL

const val MAX_VIDEO_BYTES = 50L * 1024 * 1024
private const val MAX_PHOTO_EDGE = 2000

/** A photo or video the person picked, ready to upload. Photos are already scaled down and saved as JPEG. */
class PendingAttachment(
    val filename: String,
    val contentType: String,
    val bytes: ByteArray,
    val isVideo: Boolean,
    val thumb: Bitmap?,
)

/** A reason a picked file can't be sent. [message] is plain English for the staff app; [ui] is translated for parents. */
class AttachmentException(val ui: UiText, override val message: String) : Exception(message)

/** Reads what the photo picker returned: shrinks photos to at most ~2000px JPEG, accepts videos up to 50 MB. */
object AttachmentReader {
    suspend fun read(resolver: ContentResolver, uri: Uri): PendingAttachment = withContext(Dispatchers.IO) {
        val type = resolver.getType(uri).orEmpty()
        when {
            type.startsWith("image/") -> photo(resolver, uri)
            type == "video/mp4" || type == "video/quicktime" -> video(resolver, uri, type)
            type.startsWith("video/") -> throw AttachmentException(UiText.Res(R.string.chat_file_unsupported), "This video format is not supported. Use MP4.")
            else -> throw AttachmentException(UiText.Res(R.string.chat_file_unsupported), "This kind of file can't be sent.")
        }
    }

    /** A profile picture: the photo shrunk to at most [maxEdge] pixels on its long side and saved as JPEG. */
    suspend fun profilePhoto(resolver: ContentResolver, uri: Uri, maxEdge: Int): ByteArray = withContext(Dispatchers.IO) {
        if (resolver.getType(uri).orEmpty().startsWith("image/")) photo(resolver, uri, maxEdge).bytes
        else throw AttachmentException(UiText.Res(R.string.chat_file_unsupported), "Choose a photo.")
    }

    private fun photo(resolver: ContentResolver, uri: Uri, maxEdge: Int = MAX_PHOTO_EDGE): PendingAttachment {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxEdge) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        var bmp = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
            ?: throw AttachmentException(UiText.Res(R.string.chat_file_unsupported), "This photo can't be read.")
        val longest = maxOf(bmp.width, bmp.height)
        if (longest > maxEdge) {
            val k = maxEdge.toFloat() / longest
            bmp = Bitmap.createScaledBitmap(bmp, (bmp.width * k).toInt(), (bmp.height * k).toInt(), true)
        }
        val degrees = resolver.openInputStream(uri)?.use {
            when (ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } ?: 0f
        if (degrees != 0f) bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(degrees) }, true)
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.JPEG, 85, out)
        val k = 160f / maxOf(bmp.width, bmp.height)
        val thumb = Bitmap.createScaledBitmap(bmp, maxOf(1, (bmp.width * k).toInt()), maxOf(1, (bmp.height * k).toInt()), true)
        return PendingAttachment("photo.jpg", "image/jpeg", out.toByteArray(), false, thumb)
    }

    private fun video(resolver: ContentResolver, uri: Uri, type: String): PendingAttachment {
        val out = ByteArrayOutputStream()
        resolver.openInputStream(uri)?.use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                out.write(buf, 0, n)
                if (out.size() > MAX_VIDEO_BYTES) throw AttachmentException(UiText.Res(R.string.chat_file_too_large), "This video is larger than 50 MB.")
            }
        } ?: throw AttachmentException(UiText.Res(R.string.chat_file_unsupported), "This video can't be read.")
        val ext = if (type == "video/quicktime") "mov" else "mp4"
        return PendingAttachment("video.$ext", type, out.toByteArray(), true, null)
    }
}

/** The picture behind an image attachment, fetched through its signed link; null while loading or if it can't be read. */
@Composable
fun rememberAttachmentBitmap(id: String, urlFor: suspend (String) -> String, sampleSize: Int = 2): State<Bitmap?> =
    produceState<Bitmap?>(null, id) {
        value = try {
            val url = urlFor(id)
            withContext(Dispatchers.IO) {
                val opts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
                URL(url).openStream().use { BitmapFactory.decodeStream(it, null, opts) }
            }
        } catch (_: Exception) { null }
    }

/** A message's attachments: photos show as pictures, everything else as a tile that opens in another app. */
@Composable
fun AttachmentList(attachments: List<MessageAttachment>, urlFor: suspend (String) -> String, tint: Color) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp)) {
        attachments.forEach { a ->
            if (a.isImage) {
                val bitmap by rememberAttachmentBitmap(a.id, urlFor)
                val b = bitmap
                Box(
                    Modifier.widthIn(max = 240.dp).heightIn(min = 80.dp, max = 280.dp).clip(RoundedCornerShape(14.dp))
                        .background(Krevo.colors.fill)
                        .clickable {
                            scope.launch { openUrl(context, urlFor(a.id), a.contentType) }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    if (b != null) Image(b.asImageBitmap(), contentDescription = a.filename, contentScale = ContentScale.FillWidth, modifier = Modifier.fillMaxWidth())
                    else Text(a.filename, style = MaterialTheme.typography.bodySmall, color = Krevo.colors.textSecondary, modifier = Modifier.padding(12.dp))
                }
            } else {
                Box(
                    Modifier.widthIn(max = 240.dp).clip(RoundedCornerShape(14.dp)).background(tint.copy(alpha = 0.14f))
                        .clickable { scope.launch { openUrl(context, urlFor(a.id), a.contentType) } }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically) {
                        if (a.isVideo) {
                            Box(Modifier.size(36.dp).background(tint, CircleShape), contentAlignment = Alignment.Center) {
                                Icon(Icons.Filled.PlayArrow, contentDescription = stringResource(R.string.chat_open_video), tint = Krevo.colors.bg)
                            }
                            androidx.compose.foundation.layout.Spacer(Modifier.size(10.dp))
                        }
                        Text(a.filename, style = MaterialTheme.typography.bodyMedium, color = tint)
                    }
                }
            }
        }
    }
}

private fun openUrl(context: android.content.Context, url: String, type: String) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(url), type).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: Exception) {
        try { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) { }
    }
}
