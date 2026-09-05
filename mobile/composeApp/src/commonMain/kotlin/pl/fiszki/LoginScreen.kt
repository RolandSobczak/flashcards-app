package pl.fiszki

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(state: AppState) {
    var email by remember { mutableStateOf(state.email.orEmpty()) }
    var code by remember { mutableStateOf("") }
    var kodWyslany by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var info by remember { mutableStateOf<String?>(null) }
    var blad by remember { mutableStateOf<String?>(state.error) }
    var serwerWidoczny by remember { mutableStateOf(false) }
    var serwer by remember { mutableStateOf(state.baseUrl) }
    val scope = rememberCoroutineScope()

    fun wyslijKod() {
        if (email.isBlank() || busy) return
        busy = true; blad = null; info = null
        scope.launch {
            try {
                state.setBaseUrl(serwer)
                state.requestCode(email.trim())
                kodWyslany = true
                info = "Wysłaliśmy kod na podany adres."
            } catch (e: ApiException) {
                // 429 to cooldown, a nie odmowa: poprzedni kod wciąż jest ważny
                // i leży w skrzynce. Zatrzymanie się na pierwszym kroku odcięłoby
                // jedyne pole, w które można go wpisać — dokładnie ten sam błąd
                // naprawiliśmy w kliencie webowym.
                if (e.status == 429) {
                    kodWyslany = true
                    info = "Kod już do Ciebie poszedł — sprawdź skrzynkę."
                } else {
                    blad = e.message
                }
            } catch (e: Exception) {
                blad = e.message ?: "Nie udało się wysłać kodu."
            } finally {
                busy = false
            }
        }
    }

    fun potwierdz() {
        if (code.isBlank() || busy) return
        busy = true; blad = null
        scope.launch {
            try {
                state.verify(email.trim(), code.trim())
            } catch (e: ApiException) {
                blad = e.message
            } catch (e: Exception) {
                blad = e.message ?: "Nieprawidłowy kod."
            } finally {
                busy = false
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Fiszki", style = MaterialTheme.typography.headlineMedium)
        Text(
            if (kodWyslany) "Wpisz kod wysłany na $email" else "Podaj adres e-mail, a wyślemy Ci jednorazowy kod.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Adres e-mail") },
            singleLine = true,
            enabled = !kodWyslany && !busy,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth(),
        )

        if (kodWyslany) {
            OutlinedTextField(
                value = code,
                onValueChange = { code = it.filter(Char::isDigit).take(6) },
                label = { Text("Kod z e-maila") },
                singleLine = true,
                enabled = !busy,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        info?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
        blad?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }

        Button(
            onClick = { if (kodWyslany) potwierdz() else wyslijKod() },
            enabled = !busy && (if (kodWyslany) code.isNotBlank() else email.isNotBlank()),
            modifier = Modifier.fillMaxWidth(),
        ) {
            if (busy) CircularProgressIndicator(modifier = Modifier.padding(2.dp))
            else Text(if (kodWyslany) "Zaloguj" else "Wyślij kod")
        }

        if (kodWyslany) {
            TextButton(onClick = { kodWyslany = false; code = ""; info = null; blad = null }, enabled = !busy) {
                Text("Zmień adres")
            }
        }

        TextButton(onClick = { serwerWidoczny = !serwerWidoczny }) {
            Text(if (serwerWidoczny) "Ukryj serwer" else "Serwer")
        }
        if (serwerWidoczny) {
            OutlinedTextField(
                value = serwer,
                onValueChange = { serwer = it },
                label = { Text("Adres serwera") },
                singleLine = true,
                supportingText = { Text("Emulator widzi lokalny backend pod http://10.0.2.2:8000") },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
