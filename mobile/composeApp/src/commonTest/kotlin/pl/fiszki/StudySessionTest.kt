package pl.fiszki

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

private fun cards(n: Int) = (1..n).map { Card(id = it, position = it - 1, front = "P$it", back = "O$it") }

class StudySessionTest {
    private val bezTasowania: (List<Int>) -> List<Int> = { it }

    @Test
    fun przechodzi_kolejke_liniowo() {
        var s = StudySession.start(cards(3), bezTasowania)
        assertEquals(1, s.current?.id)
        s = s.know()
        assertEquals(2, s.current?.id)
        s = s.skip()
        assertEquals(3, s.current?.id)
        assertFalse(s.roundFinished)
        s = s.skip()
        assertTrue(s.roundFinished)
        assertNull(s.current)
    }

    @Test
    fun kolejna_runda_bierze_tylko_nieopanowane() {
        var s = StudySession.start(cards(3), bezTasowania)
        s = s.know().skip().know()          // opanowane: 1 i 3
        assertTrue(s.roundFinished)
        s = s.nextRound(bezTasowania)
        assertEquals(listOf(2), s.queue)
        assertEquals(0, s.index)
        assertEquals(2, s.current?.id)
    }

    @Test
    fun runda_konczy_sie_gdy_wszystko_opanowane() {
        var s = StudySession.start(cards(2), bezTasowania)
        s = s.know().know()
        assertTrue(s.allKnown)
        assertEquals(emptyList(), s.nextRound(bezTasowania).queue)
    }

    @Test
    fun ocena_po_koncu_rundy_nic_nie_psuje() {
        var s = StudySession.start(cards(1), bezTasowania).know()
        assertTrue(s.roundFinished)
        val poZbednymSkipie = s.skip()
        assertEquals(s, poZbednymSkipie)
        assertEquals(s, s.know())
    }

    @Test
    fun opanowana_karta_nie_liczy_sie_dwa_razy() {
        var s = StudySession.start(cards(2), bezTasowania)
        s = s.know()
        s = s.copy(index = 0).know()        // ta sama karta oceniona ponownie
        assertEquals(setOf(1), s.known)
    }
}
