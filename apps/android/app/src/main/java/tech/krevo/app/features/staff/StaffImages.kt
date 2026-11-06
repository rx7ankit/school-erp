package tech.krevo.app.features.staff

import androidx.compose.runtime.getValue
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import tech.krevo.app.data.staff.initialsOf
import tech.krevo.app.design.Krevo
import java.net.URL

// Pictures that come from a link: the person's photo and the school's logo. The links are short-lived, so a picture is
// cached under the link's path (without the signature) and the same picture is not downloaded twice.

private val cache = object : LruCache<String, Bitmap>(24) {}

private fun cacheKey(url: String) = url.substringBefore('?')

/** The picture at [url], or null while it loads, if it fails, or when there is no link. */
@Composable
private fun rememberRemoteBitmap(url: String?): Bitmap? {
    val bitmap by produceState<Bitmap?>(url?.let { cache.get(cacheKey(it)) }, url) {
        if (url == null) { value = null; return@produceState }
        cache.get(cacheKey(url))?.let { value = it; return@produceState }
        value = try {
            withContext(Dispatchers.IO) {
                URL(url).openStream().use { BitmapFactory.decodeStream(it) }
            }?.also { cache.put(cacheKey(url), it) }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) { null }
    }
    return bitmap
}

/** A round picture, or the person's initials on a black circle until there is one. */
@Composable
fun PersonAvatar(name: String, photoUrl: String?, size: Dp, modifier: Modifier = Modifier) {
    val bitmap = rememberRemoteBitmap(photoUrl)
    Box(modifier.size(size).clip(CircleShape).background(Krevo.colors.solid), contentAlignment = Alignment.Center) {
        if (bitmap != null) {
            Image(bitmap.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(size))
        } else {
            Text(initialsOf(name), style = TextStyle(fontSize = (size.value * 0.38f).sp, fontWeight = FontWeight.Bold), color = Krevo.colors.onSolid)
        }
    }
}

/** The school's logo, or its first letters on a soft orange tile until the school uploads one. */
@Composable
fun SchoolMark(name: String, logoUrl: String?, size: Dp, modifier: Modifier = Modifier) {
    val bitmap = rememberRemoteBitmap(logoUrl)
    val letters: TextUnit = (size.value * 0.36f).sp
    Box(
        modifier.size(size).clip(RoundedCornerShape(size * 0.28f)).background(if (bitmap != null) Krevo.colors.bg else Krevo.colors.accentSubtle),
        contentAlignment = Alignment.Center,
    ) {
        if (bitmap != null) {
            Image(bitmap.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.size(size * 0.84f))
        } else {
            Text(initialsOf(name), style = TextStyle(fontSize = letters, fontWeight = FontWeight.Bold), color = Krevo.colors.accent)
        }
    }
}
