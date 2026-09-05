package pl.fiszki

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle

/**
 * Tekst karty z obsługą wzorów.
 *
 * Bez wzoru w treści renderuje zwykły Text — to zdecydowana większość kart,
 * a jest to i szybsze, i lepiej się zaznacza. Dopiero wzór uruchamia widok
 * platformy z KaTeX-em.
 */
@Composable
fun CardText(text: String, modifier: Modifier = Modifier, style: TextStyle = MaterialTheme.typography.bodyLarge) {
    if (text.isBlank()) return
    if (!containsMath(text)) {
        Text(text, modifier = modifier, style = style)
    } else {
        MathText(text, MaterialTheme.colorScheme.onSurface, style.fontSize.value.toInt(), modifier)
    }
}

/** Render wzorów przez KaTeX. Android: WebView, iOS: WKWebView. */
@Composable
expect fun MathText(text: String, color: Color, fontSizePx: Int, modifier: Modifier)

internal fun Color.toCssHex(): String {
    fun kanal(v: Float) = ((v * 255).toInt().coerceIn(0, 255)).toString(16).padStart(2, '0')
    return "#${kanal(red)}${kanal(green)}${kanal(blue)}"
}
