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
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Wszystkie karty zestawu w jednej liście — odpowiednik widoku „Wszystkie
 * karty" z weba. Karta wyboru pokazuje opcje z zaznaczoną poprawną, karta
 * dopasowań pary w kolejności zestawu; tu wolno widzieć odpowiedzi, bo to
 * przegląd materiału, a nie nauka.
 */
@Composable
fun BrowseScreen(state: AppState, set: SetDetail) {
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = state::backToSetup) { Text("← Zestaw") }
            Text(
                "${set.cards.size} kart",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            itemsIndexed(set.cards, key = { _, karta -> karta.id }) { i, karta ->
                KartaNaLiscie(state, karta, i + 1)
            }
        }
    }
}

@Composable
private fun KartaNaLiscie(state: AppState, karta: CardModel, numer: Int) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Etykieta("$numer")

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
        }
    }
}
