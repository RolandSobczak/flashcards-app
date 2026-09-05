package pl.fiszki

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.interop.UIKitView
import androidx.compose.ui.unit.dp
import platform.Foundation.NSBundle
import platform.Foundation.NSURL
import platform.WebKit.WKWebView
import platform.WebKit.WKWebViewConfiguration

/**
 * Odpowiednik androidowego widoku dla iOS.
 *
 * Uwaga: tego kodu nie da się zbudować ani uruchomić poza macOS z Xcode, więc
 * w odróżnieniu od reszty repozytorium nie został sprawdzony kompilacją.
 * Wysokość jest na razie stała — most pomiarowy analogiczny do androidowego
 * wymaga WKScriptMessageHandler i dołożenia zasobów KaTeX do bundla iOS.
 */
@Composable
actual fun MathText(text: String, color: Color, fontSizePx: Int, modifier: Modifier) {
    val html = mathHtml(text, color.toCssHex(), fontSizePx)
    UIKitView(
        factory = {
            WKWebView(frame = platform.CoreGraphics.CGRectZero.readValue(), configuration = WKWebViewConfiguration()).apply {
                opaque = false
                val baza = NSBundle.mainBundle.resourceURL?.URLByAppendingPathComponent("katex")
                loadHTMLString(html, baseURL = baza ?: NSURL(string = "about:blank"))
            }
        },
        modifier = modifier.fillMaxWidth().height(160.dp),
    )
}
