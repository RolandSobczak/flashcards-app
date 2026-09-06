package pl.fiszki

import com.russhwolf.settings.MapSettings
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

private fun karty(n: Int) = (1..n).map { Card(id = it, position = it - 1, front = "P$it", back = "O$it") }

class ProgressTest {
    @Test
    fun zapis_i_odczyt_rundy() {
        val store = ProgressStore(MapSettings())
        val sesja = StudySession.startChunked(karty(4), 2) { it }.know()
        store.save(7, sesja)

        val wznowiona = wznow(store.load(7), karty(4))
        assertNotNull(wznowiona)
        assertEquals(setOf(1), wznowiona.known)
        assertEquals(1, wznowiona.index)
        assertEquals(listOf(listOf(1, 2), listOf(3, 4)), wznowiona.chunks)
    }

    @Test
    fun nietknieta_runda_nie_jest_do_wznowienia() {
        val store = ProgressStore(MapSettings())
        store.save(1, StudySession.start(karty(3)) { it })
        assertNull(wznow(store.load(1), karty(3)))
    }

    @Test
    fun opanowany_zestaw_nie_jest_do_wznowienia() {
        val sesja = StudySession.start(karty(2)) { it }.know().know()
        assertNull(wznow(sesja.zapis(), karty(2)))
    }

    @Test
    fun karty_ktorych_juz_nie_ma_wypadaja() {
        val sesja = StudySession.start(karty(3)) { it }.know()
        val wznowiona = wznow(sesja.zapis(), karty(3).filter { it.id != 3 })
        assertNotNull(wznowiona)
        assertEquals(listOf(1, 2), wznowiona.queue)
    }

    @Test
    fun kasowanie_postepu_konczy_wznawianie() {
        val store = ProgressStore(MapSettings())
        store.save(3, StudySession.start(karty(3)) { it }.know())
        store.clear(3)
        assertNull(store.load(3))
    }
}
