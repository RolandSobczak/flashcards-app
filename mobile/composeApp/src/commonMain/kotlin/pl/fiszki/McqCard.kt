package pl.fiszki

import pl.fiszki.Card as CardModel

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

internal val POPRAWNY = Color(0xFF34D399)
internal val BLEDNY = Color(0xFFF87171)

/**
 * Karta wyboru: pytanie, klikalne opcje, po odpowiedzi wyjaśnienie z tyłu karty.
 *
 * Ocena idzie za wyborem, a nie za samooceną — trafiona odpowiedź liczy się
 * jako „umiem", nietrafiona wraca do kolejnej rundy. Tak samo działa web.
 */
@Composable
fun McqCard(
    state: AppState,
    card: CardModel,
    mcq: Mcq,
    poprawna: String,
    onKnow: () -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var wybrana by remember(card.id) { mutableStateOf<String?>(null) }
    var poddane by remember(card.id) { mutableStateOf(false) }

    val odkryte = wybrana != null || poddane
    val trafione = wybrana == poprawna

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(
            Modifier.weight(1f).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Etykieta("PYTANIE")
                    CardText(mcq.question)
                    card.frontImage?.let { RemoteImage(state.api, it, Modifier.heightIn(max = 320.dp)) }
                }
            }

            mcq.options.forEach { opcja ->
                val kolor = when {
                    !odkryte -> MaterialTheme.colorScheme.onSurface
                    opcja.letter == poprawna -> POPRAWNY
                    opcja.letter == wybrana -> BLEDNY
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
                OutlinedButton(
                    onClick = { if (!odkryte) wybrana = opcja.letter },
                    enabled = !odkryte,
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, kolor),
                ) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("${opcja.letter})", fontWeight = FontWeight.SemiBold, color = kolor)
                        CardText(opcja.text, style = MaterialTheme.typography.bodyMedium.copy(color = kolor))
                    }
                }
            }

            if (wybrana != null) {
                Text(
                    if (trafione) "Poprawnie!" else "Niepoprawnie — prawidłowa odpowiedź: $poprawna)",
                    color = if (trafione) POPRAWNY else BLEDNY,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                )
            }

            if (odkryte) {
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
                onClick = { if (trafione) onKnow() else onSkip() },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Następne pytanie") }
        } else {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = { poddane = true }, modifier = Modifier.weight(1f)) {
                    Text("Jeszcze nie umiem")
                }
                Button(onClick = {}, enabled = false, modifier = Modifier.weight(1f)) { Text("Umiem") }
            }
        }
    }
}

@Composable
internal fun Etykieta(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
