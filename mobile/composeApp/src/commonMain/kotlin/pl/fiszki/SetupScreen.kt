package pl.fiszki

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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

/**
 * Ekran zestawu przed nauką: ile kart, jak się uczyć i co z zestawem zrobić.
 *
 * Web pokazuje go zawsze po wybraniu zestawu — nie tylko przy dużych
 * zestawach — bo to również miejsce na operacje na zestawie. Mobilka robi
 * tak samo, żeby obie aplikacje miały tę samą drogę do nauki.
 */
@Composable
fun SetupScreen(state: AppState, set: SetDetail) {
    val liczba = set.cards.size
    var rozmiarPartii by remember(set.id) { mutableStateOf(10) }
    val partie = if (rozmiarPartii > 0) (liczba + rozmiarPartii - 1) / rozmiarPartii else 0

    Column(
        Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextButton(onClick = state::backToSets) { Text("← Zestawy") }
        Text(set.label, style = MaterialTheme.typography.headlineSmall)
        Text(
            "$liczba kart" + if (liczba >= PROG_PARTII) " — duży zestaw, można uczyć się partiami" else "",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (liczba >= PROG_PARTII) {
            Card(
                Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Nauka partiami", fontWeight = FontWeight.SemiBold)
                    Text(
                        "Po każdej opanowanej partii przejdziesz do następnej. Na końcu — przegląd całego zestawu.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Rozmiar partii:", style = MaterialTheme.typography.bodySmall)
                        OutlinedButton(onClick = { rozmiarPartii = (rozmiarPartii - 5).coerceAtLeast(5) }) { Text("−") }
                        Text("$rozmiarPartii", fontWeight = FontWeight.SemiBold)
                        OutlinedButton(onClick = { rozmiarPartii = (rozmiarPartii + 5).coerceAtMost(liczba) }) { Text("+") }
                        Text(
                            "$partie partii",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Button(
                        onClick = { state.startStudy(set, StudySession.startChunked(set.cards, rozmiarPartii)) },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Zacznij partiami") }
                }
            }
        }

        OutlinedButton(
            onClick = { state.startStudy(set, StudySession.start(set.cards)) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Cały zestaw na raz ($liczba kart)") }
    }
}
