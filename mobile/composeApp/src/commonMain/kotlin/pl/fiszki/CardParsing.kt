package pl.fiszki

/**
 * Rozpoznawanie kart wyboru w treści karty.
 *
 * Format jest taki sam jak w kliencie webowym (`src/utils.js`): przód to
 * pytanie, a pod nim wiersze `a) ...` do `d) ...`, tył zaczyna się od
 * `**a)` wskazującego poprawną odpowiedź. Dane trzyma zwykły tekst karty,
 * więc obie aplikacje muszą go czytać tak samo — stąd te same reguły
 * i ten sam próg dwóch opcji.
 */
data class McqOption(val letter: String, val text: String)

data class Mcq(val question: String, val options: List<McqOption>)

private val WIERSZ_OPCJI = Regex("""^([a-d])\)\s*(.+)$""")
private val POPRAWNA = Regex("""^\*\*([a-d])\)""")

fun parseMcq(front: String): Mcq? {
    val options = mutableListOf<McqOption>()
    val questionLines = mutableListOf<String>()

    for (line in front.lineSequence()) {
        val m = WIERSZ_OPCJI.find(line.trim())
        when {
            m != null -> options += McqOption(m.groupValues[1], m.groupValues[2])
            // Wiersze po pierwszej opcji to jej dalszy ciąg albo szum — pytanie
            // zbieramy tylko sprzed opcji, tak jak web.
            options.isEmpty() && line.isNotBlank() -> questionLines += line
        }
    }

    if (options.size < 2) return null
    return Mcq(questionLines.joinToString("\n").trim(), options)
}

/** Litera poprawnej odpowiedzi z tyłu karty albo null, gdy tył jej nie wskazuje. */
fun correctLetter(back: String): String? = POPRAWNA.find(back)?.groupValues?.get(1)
