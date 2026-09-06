package pl.fiszki

import pl.fiszki.Card as CardModel

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.MaterialTheme
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
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive

/**
 * Wszystkie karty zestawu w jednej liście — odpowiednik widoku „Wszystkie
 * karty" z weba. Karta wyboru pokazuje opcje z zaznaczoną poprawną, karta
 * dopasowań pary w kolejności zestawu; tu wolno widzieć odpowiedzi, bo to
 * przegląd materiału, a nie nauka.
 */
@Composable
fun BrowseScreen(state: AppState, set: SetDetail) {
    var doSkasowania by remember { mutableStateOf<CardModel?>(null) }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = state::backToSetup) { Text("← Zestaw") }
            Text(
                "${set.cards.size} kart",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        state.error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            itemsIndexed(set.cards, key = { _, karta -> karta.id }) { i, karta ->
                KartaNaLiscie(
                    state = state,
                    karta = karta,
                    numer = i + 1,
                    pierwsza = i == 0,
                    ostatnia = i == set.cards.lastIndex,
                    jedyna = set.cards.size == 1,
                    onMove = { delta -> state.moveCard(i, delta) },
                    onDelete = { doSkasowania = karta },
                )
            }
        }
    }

    doSkasowania?.let { karta ->
        AlertDialog(
            onDismissRequest = { doSkasowania = null },
            title = { Text("Skasować kartę?") },
            text = { Text(karta.front.trim().lineSequence().first().take(80)) },
            confirmButton = {
                Button(onClick = { state.deleteCard(karta.id); doSkasowania = null }) { Text("Skasuj") }
            },
            dismissButton = { OutlinedButton(onClick = { doSkasowania = null }) { Text("Anuluj") } },
        )
    }
}

@Composable
private fun KartaNaLiscie(
    state: AppState,
    karta: CardModel,
    numer: Int,
    pierwsza: Boolean,
    ostatnia: Boolean,
    jedyna: Boolean,
    onMove: (Int) -> Unit,
    onDelete: () -> Unit,
) {
    var edycja by remember(karta.id) { mutableStateOf(false) }

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Etykieta("$numer")

            if (edycja) {
                Edycja(state, karta) { edycja = false }
                return@Column
            }

            val pary = karta.matching?.pairs
            val mcq = parseMcq(karta.front)
            val poprawna = mcq?.let { correctLetter(karta.back) }

            CardText(if (mcq != null && poprawna != null) mcq.question else karta.front)
            karta.frontImage?.let { RemoteImage(state.api, it, Modifier.heightIn(max = 240.dp)) }

            when {
                pary != null -> pary.forEach { para ->
                    CardText(
                        "${para.getOrElse(0) { "" }} → ${para.getOrElse(1) { "" }}",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }

                mcq != null && poprawna != null -> {
                    mcq.options.forEach { opcja ->
                        val trafiona = opcja.letter == poprawna
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                "${opcja.letter})",
                                fontWeight = if (trafiona) FontWeight.SemiBold else FontWeight.Normal,
                                color = if (trafiona) POPRAWNY else MaterialTheme.colorScheme.onSurface,
                            )
                            CardText(
                                opcja.text,
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    color = if (trafiona) POPRAWNY else MaterialTheme.colorScheme.onSurface,
                                ),
                            )
                        }
                    }
                    HorizontalDivider()
                    CardText(karta.back, style = MaterialTheme.typography.bodyMedium)
                    karta.backImage?.let { RemoteImage(state.api, it, Modifier.heightIn(max = 240.dp)) }
                }

                else -> {
                    HorizontalDivider()
                    CardText(karta.back, style = MaterialTheme.typography.bodyMedium)
                    karta.backImage?.let { RemoteImage(state.api, it, Modifier.heightIn(max = 240.dp)) }
                    karta.symbols?.split(';')?.map(String::trim)?.filter(String::isNotEmpty)?.forEach {
                        CardText("• $it", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { edycja = true }, enabled = !state.mutating) { Text("Edytuj") }
                TextButton(onClick = { onMove(-1) }, enabled = !state.mutating && !pierwsza) { Text("↑") }
                TextButton(onClick = { onMove(1) }, enabled = !state.mutating && !ostatnia) { Text("↓") }
                // Backend nie pozwala skasować ostatniej karty zestawu —
                // od tego jest kasowanie całego zestawu.
                TextButton(onClick = onDelete, enabled = !state.mutating && !jedyna) { Text("Skasuj") }
            }
        }
    }
}

/**
 * Edycja treści karty. Obrazek da się tylko usunąć — dodanie wymaga wyboru
 * pliku z urządzenia, czego ta wersja nie robi; od wstawiania obrazków jest
 * web i serwer MCP.
 */
@Composable
private fun Edycja(state: AppState, karta: CardModel, koniec: () -> Unit) {
    var przod by remember(karta.id) { mutableStateOf(karta.front) }
    var tyl by remember(karta.id) { mutableStateOf(karta.back) }
    var bezPrzodu by remember(karta.id) { mutableStateOf(false) }
    var bezTylu by remember(karta.id) { mutableStateOf(false) }

    OutlinedTextField(
        value = przod,
        onValueChange = { przod = it },
        label = { Text("Przód") },
        modifier = Modifier.fillMaxWidth(),
    )
    if (karta.matching == null) {
        OutlinedTextField(
            value = tyl,
            onValueChange = { tyl = it },
            label = { Text("Tył") },
            modifier = Modifier.fillMaxWidth(),
        )
    }
    if (karta.frontImage != null) {
        TextButton(onClick = { bezPrzodu = !bezPrzodu }) {
            Text(if (bezPrzodu) "Obraz przodu: do usunięcia" else "Usuń obraz przodu")
        }
    }
    if (karta.backImage != null) {
        TextButton(onClick = { bezTylu = !bezTylu }) {
            Text(if (bezTylu) "Obraz tyłu: do usunięcia" else "Usuń obraz tyłu")
        }
    }

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
            onClick = {
                val zmiany = buildMap<String, JsonElement> {
                    if (przod != karta.front) put("front", JsonPrimitive(przod))
                    if (tyl != karta.back) put("back", JsonPrimitive(tyl))
                    if (bezPrzodu) put("frontImage", JsonNull)
                    if (bezTylu) put("backImage", JsonNull)
                }
                if (zmiany.isEmpty()) koniec() else state.updateCard(karta.id, zmiany, koniec)
            },
            enabled = !state.mutating,
        ) { Text("Zapisz") }
        OutlinedButton(onClick = koniec, enabled = !state.mutating) { Text("Anuluj") }
    }
}
