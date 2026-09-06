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
fun StudyScreen(state: AppState, set: SetDetail) {
    var sesja by remember(set.id) { mutableStateOf(StudySession.start(set.cards)) }
    var odwrocona by remember(set.id) { mutableStateOf(false) }

    fun ocena(umiem: Boolean) {
        sesja = if (umiem) sesja.know() else sesja.skip()
        odwrocona = false
    }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = state::backToSets) { Text("← Zestawy") }
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
                opanowane = sesja.known.size,
                wszystkie = set.cards.size,
                wszystkoUmiem = sesja.allKnown,
                naNowo = { sesja = sesja.nextRound(); odwrocona = false },
                doZestawow = state::backToSets,
            )
            return@Column
        }

        Text(
            "Karta ${sesja.index + 1} / ${sesja.queue.size}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

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
                    karta.matching?.pairs?.forEach { para ->
                        if (para.size >= 2) {
                            CardText("${para[0]} → ${para[1]}", style = MaterialTheme.typography.bodyMedium)
                        }
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
    opanowane: Int,
    wszystkie: Int,
    wszystkoUmiem: Boolean,
    naNowo: () -> Unit,
    doZestawow: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            if (wszystkoUmiem) "Cały zestaw opanowany" else "Koniec rundy",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            "Opanowane $opanowane z $wszystkie kart",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (!wszystkoUmiem) {
            Button(onClick = naNowo, modifier = Modifier.fillMaxWidth()) { Text("Kolejna runda z resztą") }
        }
        OutlinedButton(onClick = doZestawow, modifier = Modifier.fillMaxWidth()) { Text("Wróć do zestawów") }
    }
}
