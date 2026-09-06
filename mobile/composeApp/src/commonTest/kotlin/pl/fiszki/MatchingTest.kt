package pl.fiszki

import kotlin.test.Test
import kotlin.test.assertEquals

class MatchingTest {
    @Test
    fun zamienia_sasiadow() {
        assertEquals(listOf(1, 0, 2), przesun(listOf(0, 1, 2), 0, 1))
        assertEquals(listOf(0, 2, 1), przesun(listOf(0, 1, 2), 2, -1))
    }

    @Test
    fun poza_zakresem_nic_nie_zmienia() {
        assertEquals(listOf(0, 1, 2), przesun(listOf(0, 1, 2), 0, -1))
        assertEquals(listOf(0, 1, 2), przesun(listOf(0, 1, 2), 2, 1))
    }
}
