package pl.fiszki

/**
 * Przygotowanie treści karty do renderowania wzorów.
 *
 * Aplikacja nie ma własnego renderera matematyki — używa tego samego KaTeX-a
 * co klient webowy, wczytanego z zasobów aplikacji. Dzięki temu wzór wygląda
 * na telefonie tak samo jak w przeglądarce i nie ma drugiej implementacji,
 * która mogłaby się rozjechać.
 *
 * Tu jest tylko czysta część: wykrycie, czy w tekście w ogóle jest wzór,
 * i złożenie dokumentu HTML. Obie funkcje da się sprawdzić testem.
 */

private val WZOR = Regex("""(?<!\\)\$\$?""")

/**
 * Czy tekst zawiera wzór, czyli co najmniej dwa nieucieczkowane znaki dolara.
 *
 * Pojedynczy dolar to zwykły znak (cena, waluta), a nie otwarcie wzoru —
 * bez tego warunku każde „koszt 5$" ładowałoby ciężki widok z KaTeX-em.
 */
fun containsMath(text: String): Boolean = WZOR.findAll(text).count() >= 2

private fun escapeHtml(text: String): String =
    text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

/**
 * Dokument HTML z treścią karty. Znaki dolara zostają nietknięte, bo to po
 * nich KaTeX rozpoznaje wzory; reszta jest escapowana, żeby treść karty nie
 * mogła wstrzyknąć znaczników.
 *
 * Wysokość dokumentu wraca do aplikacji przez most `AndroidPomiar`, bo WebView
 * nie umie sam dopasować się do treści wewnątrz przewijanej kolumny.
 */
fun mathHtml(text: String, colorHex: String = "#E2E2F0", fontSizePx: Int = 17): String = """
<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="katex.min.css">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    color: $colorHex;
    font-family: -apple-system, Roboto, sans-serif;
    font-size: ${fontSizePx}px;
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    overflow-x: hidden;
  }
  .katex { font-size: 1.05em; }
  .katex-display { margin: 0.6em 0; overflow-x: auto; overflow-y: hidden; }
</style>
</head><body>
<div id="tresc">${escapeHtml(text)}</div>
<script src="katex.min.js"></script>
<script src="auto-render.min.js"></script>
<script>
  renderMathInElement(document.getElementById('tresc'), {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false }
    ],
    throwOnError: false
  })
  function raportujWysokosc() {
    if (window.AndroidPomiar) {
      window.AndroidPomiar.wysokosc(document.body.scrollHeight)
    }
  }
  raportujWysokosc()
  window.addEventListener('load', raportujWysokosc)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(raportujWysokosc)
</script>
</body></html>
""".trimIndent()
