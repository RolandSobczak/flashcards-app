package pl.fiszki

import pl.fiszki.Card as CardModel

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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

/** Zamiana sąsiednich elementów. Poza zakresem lista wraca bez zmian. */
fun <T> przesun(lista: List<T>, index: Int, delta: Int): List<T> {
    val cel = index + delta
    if (index !in lista.indices || cel !in lista.indices) return lista
    val kopia = lista.toMutableList()
    kopia[index] = lista[cel]
    kopia[cel] = lista[index]
    return kopia
}

/**
 * Karta „dopasuj pary": lewa kolumna stoi, prawą układa uczący się.
 *
 * Prawa strona startuje przetasowana, a poprawność to zgodność pozycji
 * z oryginalną kolejnością par — tak samo jak w webie. Wcześniej karta
 * pokazywała się tu jako gotowa lista par, czyli z odpowiedzią na wierzchu.
 */
@Composable
fun MatchingCard(
    state: AppState,
    card: CardModel,
    pary: List<List<String>>,
    onKnow: () -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var kolejnosc by remember(card.id) { mutableStateOf(pary.indices.shuffled()) }
    var sprawdzone by remember(card.id) { mutableStateOf(false) }
    var poddane by remember(card.id) { mutableStateOf(false) }

    val odkryte = sprawdzone || poddane
    val wszystkoDobrze = sprawdzone && kolejnosc.withIndex().all { (i, v) -> v == i }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Etykieta("PYTANIE")
                    CardText(card.front)
                    card.frontImage?.let { RemoteImage(state.api, it, Modifier.heightIn(max = 320.dp)) }
                }
            }

            pary.forEachIndexed { i, para ->
                val prawyIdx = kolejnosc[i]
                val kolor = when {
                    !odkryte -> MaterialTheme.colorScheme.onSurface
                    prawyIdx == i -> POPRAWNY
                    else -> BLEDNY
                }
                Card(
                    Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        CardText(
                            para.getOrElse(0) { "" },
                            Modifier.weight(1f),
                            MaterialTheme.typography.bodyMedium,
                        )
                        Text("→", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        CardText(
                            pary.getOrNull(prawyIdx)?.getOrElse(1) { "" } ?: "",
                            Modifier.weight(1f),
                            MaterialTheme.typography.bodyMedium.copy(color = kolor),
                        )
                        if (!odkryte) {
                            TextButton(onClick = { kolejnosc = przesun(kolejnosc, i, -1) }, enabled = i > 0) {
                                Text("↑")
                            }
                            TextButton(
                                onClick = { kolejnosc = przesun(kolejnosc, i, 1) },
                                enabled = i < pary.lastIndex,
                            ) { Text("↓") }
                        }
                    }
                }
            }

            if (sprawdzone) {
                Text(
                    if (wszystkoDobrze) "Poprawnie!" else "Niepoprawnie",
                    color = if (wszystkoDobrze) POPRAWNY else BLEDNY,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            if (odkryte && card.back.isNotBlank()) {
                Card(
                    Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Etykieta("WYJAŚNIENIE")
                        CardText(card.back, style = MaterialTheme.typography.bodyMedium)
                        card.backImage?.let { RemoteImage(state.api, it, Modifier.heightIn(max = 320.dp)) }
                    }
                }
            }
        }

        if (odkryte) {
            Button(
                onClick = { if (wszystkoDobrze) onKnow() else onSkip() },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Następne pytanie") }
        } else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = { kolejnosc = pary.indices.toList(); poddane = true },
                    modifier = Modifier.weight(1f),
                ) { Text("Jeszcze nie umiem") }
                Button(onClick = { sprawdzone = true }, modifier = Modifier.weight(1f)) { Text("Sprawdź") }
            }
        }
    }
}
