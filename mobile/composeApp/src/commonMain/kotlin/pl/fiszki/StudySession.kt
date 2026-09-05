package pl.fiszki

/**
 * Przebieg jednej rundy nauki. Odwzorowuje zachowanie klienta webowego:
 * kolejka jest przechodzona liniowo, „umiem" dopisuje kartę do opanowanych,
 * obie oceny idą dalej, a kolejna runda to przetasowane karty, których
 * jeszcze nie umiemy.
 *
 * Klasa jest czysta — bez sieci i bez Compose'a — żeby dało się ją sprawdzić
 * testem, a nie tylko klikaniem.
 */
data class StudySession(
    val cards: List<Card>,
    val queue: List<Int>,
    val index: Int = 0,
    val known: Set<Int> = emptySet(),
) {
    val current: Card?
        get() = queue.getOrNull(index)?.let { id -> cards.firstOrNull { it.id == id } }

    val roundFinished: Boolean get() = index >= queue.size

    val allKnown: Boolean get() = known.size >= cards.size

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
        val remaining = cards.map { it.id }.filterNot { it in known }
        return copy(queue = shuffle(remaining), index = 0)
    }

    companion object {
        fun start(cards: List<Card>, shuffle: (List<Int>) -> List<Int> = { it.shuffled() }) =
            StudySession(cards = cards, queue = shuffle(cards.map { it.id }))
    }
}
