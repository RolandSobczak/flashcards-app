package pl.fiszki

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

/**
 * WebView z KaTeX-em wczytanym z zasobów aplikacji (bez sieci).
 *
 * WebView w przewijanej kolumnie nie potrafi dopasować wysokości do treści —
 * dostałby zero albo całą dostępną przestrzeń. Dlatego strona po wyrenderowaniu
 * i po dociągnięciu fontów raportuje własną wysokość mostem JavaScriptu,
 * a composable ustawia ją sobie jako wysokość widoku.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
actual fun MathText(text: String, color: Color, fontSizePx: Int, modifier: Modifier) {
    val gestosc = LocalDensity.current.density
    var wysokoscDp by remember(text) { mutableStateOf(0f) }
    val html = remember(text, color, fontSizePx) { mathHtml(text, color.toCssHex(), fontSizePx) }

    AndroidView(
        modifier = modifier.fillMaxWidth().let { if (wysokoscDp > 0f) it.height(wysokoscDp.dp) else it },
        factory = { context ->
            WebView(context).apply {
                settings.javaScriptEnabled = true
                settings.allowFileAccess = false
                settings.allowContentAccess = false
                setBackgroundColor(AndroidColor.TRANSPARENT)
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                addJavascriptInterface(
                    object {
                        @JavascriptInterface
                        fun wysokosc(px: Int) {
                            post { wysokoscDp = px / gestosc }
                        }
                    },
                    "AndroidPomiar",
                )
            }
        },
        update = { view ->
            view.loadDataWithBaseURL("file:///android_asset/katex/", html, "text/html", "utf-8", null)
        },
    )
}
