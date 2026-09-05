package pl.fiszki

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.decodeToImageBitmap
import androidx.compose.ui.layout.ContentScale

/**
 * Obrazek karty. Endpoint obrazków jest za bearerem, więc adresu nie da się
 * podać wprost komponentowi — bajty pobiera klient API, a dekoduje je
 * wieloplatformowe decodeToImageBitmap.
 */
@Composable
fun RemoteImage(api: Api, path: String, modifier: Modifier = Modifier) {
    var bitmap by remember(path) { mutableStateOf<ImageBitmap?>(null) }

    LaunchedEffect(path) {
        bitmap = runCatching { api.imageBytes(path).decodeToImageBitmap() }.getOrNull()
    }

    bitmap?.let {
        Image(
            bitmap = it,
            contentDescription = null,
            contentScale = ContentScale.FillWidth,
            modifier = modifier.fillMaxWidth(),
        )
    }
}
