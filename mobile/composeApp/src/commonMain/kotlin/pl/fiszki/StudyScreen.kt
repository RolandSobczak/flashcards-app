package pl.fiszki

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun StudyScreen(state: AppState, set: SetDetail, start: StudySession) {
    var sesja by remember(set.id) { mutableStateOf(start) }
    var odwrocona by remember(set.id) { mutableStateOf(false) }

    fun ocena(umiem: Boolean) {
        sesja = if (umiem) sesja.know() else sesja.skip()
        odwrocona = false
    }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { state.backToSetup(set) }) { Text("← Zestaw") }
            Text(
                "Opanowane ${sesja.known.size} / ${set.cards.size}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(set.label, style = MaterialTheme.typography.titleMedium)
        LinearProgressIndicator(
            progress = { if (set.cards.isEmpty()) 0f else sesja.known.size.toFloat() / set.cards.size },
            modifier = Modifier.fillMaxWidth(),
        )

        val karta = sesja.current
        if (karta == null) {
            RundaSkonczona(
                sesja = sesja,
                dalej = { sesja = it; odwrocona = false },
                doZestawu = { state.backToSetup(set) },
            )
            return@Column
        }

        Text(
            "Karta ${sesja.index + 1} / ${sesja.queue.size}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        val pary = karta.matching?.pairs
        if (pary != null && pary.size >= 2) {
            MatchingCard(
                state = state,
                card = karta,
                pary = pary,
                onKnow = { ocena(true) },
                onSkip = { ocena(false) },
                modifier = Modifier.fillMaxWidth().weight(1f),
            )
            return@Column
        }

        // Karta wyboru ma własny przebieg (opcje zamiast odwracania), więc
        // dostaje własny widok razem z przyciskami oceny.
        val mcq = parseMcq(karta.front)
        val poprawna = mcq?.let { correctLetter(karta.back) }
        if (mcq != null && poprawna != null) {
            McqCard(
                state = state,
                card = karta,
                mcq = mcq,
                poprawna = poprawna,
                onKnow = { ocena(true) },
                onSkip = { ocena(false) },
                modifier = Modifier.fillMaxWidth().weight(1f),
            )
            return@Column
        }

        Card(
            modifier = Modifier.fillMaxWidth().weight(1f).clickable { odwrocona = !odwrocona },
        ) {
            Column(
                modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    if (odwrocona) "ODPOWIEDŹ" else "PYTANIE",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                CardText(if (odwrocona) karta.back else karta.front)

                val obraz = if (odwrocona) karta.backImage else karta.frontImage
                obraz?.let { RemoteImage(state.api, it, Modifier.heightIn(max = 320.dp)) }

                if (odwrocona) {
                    karta.symbols?.split(';')?.map(String::trim)?.filter(String::isNotEmpty)?.forEach {
                        CardText("• $it", style = MaterialTheme.typography.bodySmall)
                    }
                }

                if (!odwrocona) {
                    Text(
                        "Dotknij, aby odwrócić",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = { ocena(false) }, modifier = Modifier.weight(1f)) {
                Text("Jeszcze nie umiem")
            }
            Button(onClick = { ocena(true) }, enabled = odwrocona, modifier = Modifier.weight(1f)) {
                Text("Umiem")
            }
        }
    }
}

@Composable
private fun RundaSkonczona(
    sesja: StudySession,
    dalej: (StudySession) -> Unit,
    doZestawu: () -> Unit,
) {
    val wszystkie = sesja.cards.size
    val tytul: String
    val opis: String
    when {
        sesja.chunkDone && sesja.lastChunk ->
            tytul = "Wszystkie partie opanowane"
        sesja.chunkDone ->
            tytul = "Partia ${sesja.chunkIndex + 1} opanowana"
        sesja.chunkMode ->
            tytul = "Koniec rundy — partia ${sesja.chunkIndex + 1}/${sesja.chunks.size}"
        sesja.allKnown ->
            tytul = "Cały zestaw opanowany"
        else ->
            tytul = "Koniec rundy"
    }
    opis = when {
        sesja.chunkDone && sesja.lastChunk -> "Czas na przegląd całego zestawu ($wszystkie kart)."
        sesja.chunkMode -> "W tej partii opanowane ${sesja.chunkKnown} z ${sesja.currentChunk.size}. Łącznie $wszystkie kart w zestawie."
        else -> "Opanowane ${sesja.known.size} z $wszystkie kart"
    }

    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(tytul, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text(
            opis,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        when {
            sesja.chunkDone -> Button(
                onClick = { dalej(sesja.nextChunk()) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    if (sesja.lastChunk) "Pełny zestaw (${sesja.cards.size} kart)"
                    else "Partia ${sesja.chunkIndex + 2} z ${sesja.chunks.size}",
                )
            }

            !sesja.allKnown -> Button(
                onClick = { dalej(sesja.nextRound()) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    if (sesja.chunkMode) "Kolejna runda (${sesja.chunkRemaining})"
                    else "Kolejna runda (${sesja.cards.size - sesja.known.size})",
                )
            }
        }

        OutlinedButton(onClick = { dalej(sesja.reset()) }, modifier = Modifier.fillMaxWidth()) {
            Text("Zacznij od nowa")
        }
        OutlinedButton(onClick = doZestawu, modifier = Modifier.fillMaxWidth()) { Text("Wróć do zestawu") }
    }
}
