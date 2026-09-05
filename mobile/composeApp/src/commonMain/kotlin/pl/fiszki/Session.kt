package pl.fiszki

import com.russhwolf.settings.Settings

/** Domyślny adres produkcyjny. Zmienialny na ekranie logowania — emulator
 *  Androida widzi lokalny backend pod 10.0.2.2, nie localhost. */
const val DEFAULT_BASE_URL = "https://fiszki-14m94kaf77.byst.re"

/**
 * Token sesji i adres serwera.
 *
 * Token leży w zwykłych ustawieniach platformy (SharedPreferences / NSUserDefaults),
 * chronionych piaskownicą aplikacji. Wystarcza to na tyle, na ile wystarcza
 * w kliencie webowym, gdzie token siedzi w localStorage.
 * ponytail: szyfrowany magazyn (EncryptedSharedPreferences / Keychain), jeśli
 * aplikacja zacznie trzymać coś więcej niż token do własnych fiszek.
 */
class SessionStore(private val settings: Settings) {
    var token: String?
        get() = settings.getStringOrNull(KEY_TOKEN)
        set(value) = if (value == null) settings.remove(KEY_TOKEN) else settings.putString(KEY_TOKEN, value)

    var email: String?
        get() = settings.getStringOrNull(KEY_EMAIL)
        set(value) = if (value == null) settings.remove(KEY_EMAIL) else settings.putString(KEY_EMAIL, value)

    var baseUrl: String
        get() = settings.getStringOrNull(KEY_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) = settings.putString(KEY_BASE_URL, value.trimEnd('/'))

    fun clear() {
        settings.remove(KEY_TOKEN)
        settings.remove(KEY_EMAIL)
    }

    private companion object {
        const val KEY_TOKEN = "authToken"
        const val KEY_EMAIL = "authEmail"
        const val KEY_BASE_URL = "baseUrl"
    }
}
