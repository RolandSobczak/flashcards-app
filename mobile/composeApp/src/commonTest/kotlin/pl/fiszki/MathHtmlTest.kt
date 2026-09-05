package pl.fiszki

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MathHtmlTest {
    @Test
    fun rozpoznaje_wzory_w_linii_i_wysrodkowane() {
        assertTrue(containsMath("Ile wynosi \$G(z)\$?"))
        assertTrue(containsMath("Wzór: \$\$\\frac{1}{2}\$\$"))
    }

    @Test
    fun pojedynczy_dolar_to_nie_wzor() {
        // Inaczej każda cena ładowałaby ciężki widok z KaTeX-em.
        assertFalse(containsMath("Koszt to 5\$ za sztukę"))
        assertFalse(containsMath("Bez matematyki w ogóle"))
        assertFalse(containsMath(""))
    }

    @Test
    fun ucieczkowany_dolar_sie_nie_liczy() {
        assertFalse(containsMath("Cena \\\$5 i \\\$7"))
    }

    @Test
    fun tresc_karty_nie_wstrzyknie_znacznikow() {
        val html = mathHtml("<script>alert(1)</script> & <b>pogrubienie</b>")
        assertTrue("&lt;script&gt;" in html)
        assertTrue("&amp;" in html)
        assertFalse("<script>alert(1)</script>" in html)
    }

    @Test
    fun dolary_zostaja_nietkniete_bo_po_nich_poznaje_je_katex() {
        val html = mathHtml("Stała \$\\xi\$ tłumienia")
        assertTrue("\$\\xi\$" in html)
    }

    @Test
    fun dokument_wciaga_katexa_z_zasobow_aplikacji() {
        val html = mathHtml("cokolwiek")
        assertTrue("katex.min.css" in html)
        assertTrue("katex.min.js" in html)
        assertTrue("auto-render.min.js" in html)
        assertTrue("renderMathInElement" in html)
    }
}
