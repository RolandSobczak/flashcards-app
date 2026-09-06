package pl.fiszki

import com.russhwolf.settings.Settings
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Zapis rundy jednego zestawu. Trzyma identyfikatory, nie treści kart. */
@Serializable
data class Postep(
    val known: List<Int> = emptyList(),
    val queue: List<Int> = emptyList(),
    val index: Int = 0,
    val chunks: List<List<Int>> = emptyList(),
    val chunkIndex: Int = 0,
)

fun StudySession.zapis() = Postep(known.toList(), queue, index, chunks, chunkIndex)

/**
 * Odtworzenie rundy z zapisu.
 *
 * Zestaw mógł się w międzyczasie zmienić (kartę skasowano, doszły nowe), więc
 * identyfikatory spoza aktualnego zestawu wypadają. Zwraca null, gdy nie ma
 * czego wznawiać: pusta kolejka, runda jeszcze nietknięta albo wszystko już
 * opanowane — te same warunki co w kliencie webowym.
 */
fun wznow(zapis: Postep?, cards: List<Card>): StudySession? {
    if (zapis == null) return null
    val istniejace = cards.map { it.id }.toSet()
    val queue = zapis.queue.filter { it in istniejace }
    if (queue.isEmpty()) return null

    val known = zapis.known.filter { it in istniejace }.toSet()
    val rozpoczeta = known.isNotEmpty() || zapis.index > 0
    if (!rozpoczeta) return null

    val chunks = zapis.chunks.map { chunk -> chunk.filter { it in istniejace } }.filter { it.isNotEmpty() }
    if (chunks.isEmpty() && known.size >= cards.size) return null

    return StudySession(
        cards = cards,
        queue = queue,
        index = zapis.index.coerceIn(0, queue.size),
        known = known,
        chunks = chunks,
        chunkIndex = zapis.chunkIndex.coerceIn(0, maxOf(chunks.size - 1, 0)),
    )
}

/**
 * Postęp każdego zestawu z osobna, w ustawieniach platformy — jak
 * localStorage w webie. Dzięki temu wyjście do listy zestawów i powrót
 * proponuje kontynuację zamiast zaczynać rundę od nowa.
 */
class ProgressStore(private val settings: Settings) {
    private val json = Json { ignoreUnknownKeys = true }

    fun load(setId: Int): Postep? =
        settings.getStringOrNull(key(setId))?.let { runCatching { json.decodeFromString<Postep>(it) }.getOrNull() }

    fun save(setId: Int, session: StudySession) {
        settings.putString(key(setId), json.encodeToString(session.zapis()))
    }

    fun clear(setId: Int) = settings.remove(key(setId))

    private fun key(setId: Int) = "progress:$setId"
}
