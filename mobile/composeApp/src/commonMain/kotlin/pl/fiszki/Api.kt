package pl.fiszki

import io.ktor.client.HttpClient
import io.ktor.client.HttpClientConfig
import io.ktor.client.call.body
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.client.statement.readRawBytes
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

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
