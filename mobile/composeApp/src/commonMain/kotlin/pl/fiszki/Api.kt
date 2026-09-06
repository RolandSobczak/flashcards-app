package pl.fiszki

import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.call.body
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.client.statement.readRawBytes
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * Błąd API niosący kod HTTP.
 *
 * Kod jest tu z tego samego powodu co w kliencie webowym: 429 z żądania kodu
 * logowania nie jest odmową, tylko informacją, że kod już poszedł i wciąż jest
 * ważny. Bez kodu odpowiedzi ekran logowania nie odróżniłby tego od błędu
 * i zamknąłby użytkownikowi drogę do pola, w które ma wpisać kod.
 */
class ApiException(val status: Int, override val message: String) : Exception(message)

class Api(
    private val baseUrl: String,
    private val tokenProvider: () -> String?,
    /** Podstawiany w testach (MockEngine). Bez niego Ktor wybiera silnik
     *  właściwy dla platformy: OkHttp na Androidzie, Darwin na iOS. */
    engine: HttpClientEngine? = null,
) {
    private val json = Json { ignoreUnknownKeys = true }

    private val konfiguracja: HttpClientConfig<*>.() -> Unit = {
        install(ContentNegotiation) { json(json) }
    }

    val client: HttpClient =
        if (engine == null) HttpClient(konfiguracja) else HttpClient(engine, konfiguracja)

    private suspend fun HttpResponse.orThrow(): HttpResponse {
        if (status.isSuccess()) return this
        val detail = runCatching { json.decodeFromString<ApiDetail>(bodyAsText()).detail }.getOrNull()
        throw ApiException(status.value, detail ?: "HTTP ${status.value}")
    }

    private fun HttpStatusCode.isSuccess() = value in 200..299

    suspend fun requestCode(email: String) {
        client.post("$baseUrl/api/auth/request-code") {
            contentType(ContentType.Application.Json)
            setBody(RequestCodeBody(email))
        }.orThrow()
    }

    suspend fun verifyCode(email: String, code: String): AuthResult =
        client.post("$baseUrl/api/auth/verify") {
            contentType(ContentType.Application.Json)
            setBody(VerifyBody(email, code))
        }.orThrow().body()

    suspend fun listSets(): List<SetSummary> =
        client.get("$baseUrl/api/sets") { auth() }.orThrow().body()

    suspend fun getSet(id: Int): SetDetail =
        client.get("$baseUrl/api/sets/$id") { auth() }.orThrow().body()

    /**
     * Zmiana karty. Zmiany idą jako gotowy obiekt JSON, a nie jako model
     * z polami nullowalnymi, bo backend rozróżnia "pola nie ruszaj" (brak
     * klucza) od "skasuj obrazek" (klucz z null) — serializacja modelu
     * zgubiłaby tę różnicę.
     */
    suspend fun updateCard(cardId: Int, zmiany: Map<String, JsonElement>): Card =
        client.patch("$baseUrl/api/cards/$cardId") {
            auth()
            contentType(ContentType.Application.Json)
            setBody(JsonObject(zmiany))
        }.orThrow().body()

    /** Kasowanie i zmiana kolejności zwracają cały zestaw — backend
     *  przenumerowuje pozycje, więc jego odpowiedź jest jedynym pewnym
     *  źródłem nowego układu. */
    suspend fun deleteCard(cardId: Int): SetDetail =
        client.delete("$baseUrl/api/cards/$cardId") { auth() }.orThrow().body()

    suspend fun reorderCards(setId: Int, cardIds: List<Int>): SetDetail =
        client.put("$baseUrl/api/sets/$setId/cards/order") {
            auth()
            contentType(ContentType.Application.Json)
            setBody(CardOrderBody(cardIds))
        }.orThrow().body()

    suspend fun deleteSet(setId: Int) {
        client.delete("$baseUrl/api/sets/$setId") { auth() }.orThrow()
    }

    suspend fun logout() {
        runCatching { client.post("$baseUrl/api/auth/logout") { auth() } }
    }

    /** Obrazki kart siedzą za tym samym bearerem co reszta API, więc nie da się
     *  ich podać zwykłym adresem do komponentu obrazka — trzeba pobrać bajty. */
    suspend fun imageBytes(path: String): ByteArray {
        val url = if (path.startsWith("http")) path else "$baseUrl$path"
        return client.get(url) { auth() }.orThrow().readRawBytes()
    }

    private fun io.ktor.client.request.HttpRequestBuilder.auth() {
        tokenProvider()?.let { header("Authorization", "Bearer $it") }
    }
}
