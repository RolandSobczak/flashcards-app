package pl.fiszki

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CardParsingTest {
    @Test
    fun rozpoznaje_pytanie_i_opcje() {
        val mcq = parseMcq("Ile to 2+2?\na) 3\nb) 4\nc) 5")
        assertEquals("Ile to 2+2?", mcq?.question)
        assertEquals(listOf("a", "b", "c"), mcq?.options?.map { it.letter })
        assertEquals("4", mcq?.options?.get(1)?.text)
    }

    @Test
    fun jedna_opcja_to_nie_karta_wyboru() {
        assertNull(parseMcq("Pytanie\na) jedyna"))
    }

    @Test
    fun zwykla_karta_nie_jest_karta_wyboru() {
        assertNull(parseMcq("Co to jest tranzystor?"))
    }

    @Test
    fun poprawna_litera_z_tylu_karty() {
        assertEquals("b", correctLetter("**b)** 4 — bo dwa i dwa"))
        assertNull(correctLetter("Odpowiedź: 4"))
    }
}
