package pl.fiszki

/** Powyżej tylu kart web proponuje naukę partiami — ten sam próg trzyma mobilka. */
const val PROG_PARTII = 30

/**
 * Przebieg jednej rundy nauki. Odwzorowuje zachowanie klienta webowego:
 * kolejka jest przechodzona liniowo, „umiem" dopisuje kartę do opanowanych,
 * obie oceny idą dalej, a kolejna runda to przetasowane karty, których
 * jeszcze nie umiemy.
 *
 * W trybie partii ta sama runda dotyczy tylko bieżącej partii; dopiero po
 * opanowaniu wszystkich partii wchodzi przegląd całego zestawu.
 *
 * Klasa jest czysta — bez sieci i bez Compose'a — żeby dało się ją sprawdzić
 * testem, a nie tylko klikaniem.
 */
data class StudySession(
    val cards: List<Card>,
    val queue: List<Int>,
    val index: Int = 0,
    val known: Set<Int> = emptySet(),
    /** Pusta lista = nauka całym zestawem. */
    val chunks: List<List<Int>> = emptyList(),
    val chunkIndex: Int = 0,
) {
    val current: Card?
        get() = queue.getOrNull(index)?.let { id -> cards.firstOrNull { it.id == id } }

    val roundFinished: Boolean get() = index >= queue.size

    val allKnown: Boolean get() = known.size >= cards.size

    val chunkMode: Boolean get() = chunks.isNotEmpty()

    val currentChunk: List<Int> get() = chunks.getOrElse(chunkIndex) { emptyList() }

    val chunkKnown: Int get() = currentChunk.count { it in known }

    val chunkRemaining: Int get() = currentChunk.size - chunkKnown

    /** Bieżąca partia opanowana w całości — czas na następną. */
    val chunkDone: Boolean get() = chunkMode && chunkRemaining == 0

    val lastChunk: Boolean get() = chunkIndex + 1 >= chunks.size

    fun know(): StudySession {
        val id = queue.getOrNull(index) ?: return this
        return copy(known = known + id, index = index + 1)
    }

    fun skip(): StudySession {
        if (roundFinished) return this
        return copy(index = index + 1)
    }

    /** Kolejna runda: tylko to, czego jeszcze nie umiemy, w losowej kolejności. */
    fun nextRound(shuffle: (List<Int>) -> List<Int> = { it.shuffled() }): StudySession {
        val pula = if (chunkMode) currentChunk else cards.map { it.id }
        return copy(queue = shuffle(pula.filterNot { it in known }), index = 0)
    }

    /**
     * Przejście dalej po opanowaniu partii: następna partia, a po ostatniej
     * przegląd całego zestawu od zera — opanowane partiami karty trzeba
     * zobaczyć jeszcze raz w jednym ciągu.
     */
    fun nextChunk(shuffle: (List<Int>) -> List<Int> = { it.shuffled() }): StudySession =
        if (lastChunk) {
            copy(chunks = emptyList(), chunkIndex = 0, known = emptySet(), queue = shuffle(cards.map { it.id }), index = 0)
        } else {
            copy(chunkIndex = chunkIndex + 1, queue = shuffle(chunks[chunkIndex + 1]), index = 0)
        }

    /** Nauka od nowa: bez partii, cały zestaw, zerowy licznik opanowanych. */
    fun reset(shuffle: (List<Int>) -> List<Int> = { it.shuffled() }) =
        start(cards, shuffle)

    companion object {
        fun start(cards: List<Card>, shuffle: (List<Int>) -> List<Int> = { it.shuffled() }) =
            StudySession(cards = cards, queue = shuffle(cards.map { it.id }))

        /** Nauka partiami: kolejne kawałki zestawu po [chunkSize] kart, w kolejności zestawu. */
        fun startChunked(
            cards: List<Card>,
            chunkSize: Int,
            shuffle: (List<Int>) -> List<Int> = { it.shuffled() },
        ): StudySession {
            val chunks = cards.map { it.id }.chunked(chunkSize.coerceAtLeast(1))
            if (chunks.isEmpty()) return start(cards, shuffle)
            return StudySession(
                cards = cards,
                queue = shuffle(chunks[0]),
                chunks = chunks,
            )
        }
    }
}
