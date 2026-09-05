package pl.fiszki

import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandler
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.respondError
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

private const val JSON = "application/json"

private fun api(token: String? = "tok", handler: MockRequestHandler) =
    Api("https://serwer.test", { token }, MockEngine(handler))

class ApiTest {
    @Test
    fun kod_logowania_zwraca_status_bez_tresci() = runTest {
        val a = api { respond("", HttpStatusCode.NoContent) }
        a.requestCode("ktos@example.test")   // brak wyjątku = sukces
    }

    @Test
    fun cooldown_niesie_kod_429_z_trescia_bledu() = runTest {
        val a = api {
            respondError(
                HttpStatusCode.TooManyRequests,
                """{"detail":"Poczekaj chwilę przed ponownym wysłaniem kodu"}""",
                headersOf(HttpHeaders.ContentType, JSON),
            )
        }
        val e = assertFailsWith<ApiException> { a.requestCode("ktos@example.test") }
        assertEquals(429, e.status)
        assertTrue(e.message.startsWith("Poczekaj"))
    }

    @Test
    fun weryfikacja_zwraca_token_i_uzytkownika() = runTest {
        val a = api {
            respond(
                """{"token":"abc","user":{"id":1,"email":"ktos@example.test"}}""",
                HttpStatusCode.OK,
                headersOf(HttpHeaders.ContentType, JSON),
            )
        }
        val wynik = a.verifyCode("ktos@example.test", "123456")
        assertEquals("abc", wynik.token)
        assertEquals("ktos@example.test", wynik.user.email)
    }

    @Test
    fun lista_zestawow_znosi_nieznane_pola() = runTest {
        val a = api {
            respond(
                """[{"id":2,"slug":"e","label":"Egzamin","category":"sterowanie","cardCount":44,"czegoNieZnamy":true}]""",
                HttpStatusCode.OK,
                headersOf(HttpHeaders.ContentType, JSON),
            )
        }
        val zestawy = a.listSets()
        assertEquals(1, zestawy.size)
        assertEquals("Egzamin", zestawy[0].label)
        assertEquals(44, zestawy[0].cardCount)
    }

    @Test
    fun zapytania_niosa_token_w_naglowku() = runTest {
        var naglowek: String? = null
        val a = api(token = "sekret") { zadanie ->
            naglowek = zadanie.headers[HttpHeaders.Authorization]
            respond("[]", HttpStatusCode.OK, headersOf(HttpHeaders.ContentType, JSON))
        }
        a.listSets()
        assertEquals("Bearer sekret", naglowek)
    }

    @Test
    fun wygasla_sesja_to_wyjatek_z_kodem_401() = runTest {
        val a = api {
            respondError(
                HttpStatusCode.Unauthorized,
                """{"detail":"Sesja wygasła, zaloguj się ponownie"}""",
                headersOf(HttpHeaders.ContentType, JSON),
            )
        }
        assertEquals(401, assertFailsWith<ApiException> { a.listSets() }.status)
    }

    @Test
    fun obrazek_idzie_wzgledna_sciezka_do_tego_samego_serwera() = runTest {
        var url: String? = null
        val a = api {  zadanie ->
            url = zadanie.url.toString()
            respond(byteArrayOf(1, 2, 3), HttpStatusCode.OK)
        }
        val bajty = a.imageBytes("/api/images/sets/2/0-front.png")
        assertEquals(3, bajty.size)
        assertEquals("https://serwer.test/api/images/sets/2/0-front.png", url)
    }
}
