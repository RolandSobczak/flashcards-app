package pl.fiszki

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonElement

sealed interface Screen {
    data object Login : Screen
    data object Sets : Screen
    data object Setup : Screen
    data class Study(val session: StudySession) : Screen
    data object Browse : Screen
}

/**
 * Cały stan aplikacji w jednym miejscu. Ekranów jest kilka, więc biblioteka
 * nawigacji byłaby tu cięższa od problemu, który rozwiązuje.
 */
class AppState(
    private val session: SessionStore,
    val progress: ProgressStore,
    private val scope: CoroutineScope,
    private val apiFactory: (String, () -> String?) -> Api = { url, token -> Api(url, token) },
) {
    var api: Api = apiFactory(session.baseUrl) { session.token }
        private set

    var screen by mutableStateOf<Screen>(if (session.token == null) Screen.Login else Screen.Sets)
        private set

    var sets by mutableStateOf<List<SetSummary>>(emptyList())
        private set

    /** Otwarty zestaw. Trzymany tu, a nie w ekranie, bo ten sam zestaw ogląda
     *  ekran startowy, nauka i przeglądarka kart — i wszystkie muszą widzieć
     *  te same karty po zmianie. */
    var currentSet by mutableStateOf<SetDetail?>(null)
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    val email: String? get() = session.email
    var baseUrl: String = session.baseUrl
        private set

    fun setBaseUrl(value: String) {
        val clean = value.trim().trimEnd('/')
        if (clean.isEmpty() || clean == baseUrl) return
        session.baseUrl = clean
        baseUrl = clean
        api = apiFactory(clean) { session.token }
    }

    fun clearError() {
        error = null
    }

    suspend fun requestCode(email: String) {
        session.email = email
        api.requestCode(email)
    }

    suspend fun verify(email: String, code: String) {
        val result = api.verifyCode(email, code)
        session.token = result.token
        session.email = result.user.email
        screen = Screen.Sets
        loadSets()
    }

    fun logout() {
        scope.launch { api.logout() }
        session.clear()
        sets = emptyList()
        screen = Screen.Login
    }

    fun loadSets() {
        scope.launch {
            loading = true
            error = null
            try {
                sets = api.listSets()
            } catch (e: ApiException) {
                if (e.status == 401) onSessionExpired() else error = e.message
            } catch (e: Exception) {
                error = e.message ?: "Nie udało się pobrać zestawów."
            } finally {
                loading = false
            }
        }
    }

    fun openSet(summary: SetSummary) {
        scope.launch {
            loading = true
            error = null
            try {
                currentSet = api.getSet(summary.id)
                screen = Screen.Setup
            } catch (e: ApiException) {
                if (e.status == 401) onSessionExpired() else error = e.message
            } catch (e: Exception) {
                error = e.message ?: "Nie udało się otworzyć zestawu."
            } finally {
                loading = false
            }
        }
    }

    fun startStudy(session: StudySession) {
        screen = Screen.Study(session)
    }

    /** Trwa zapis zmiany karty — blokuje przyciski, żeby dwie zmiany naraz
     *  nie ścigały się o kolejność w zestawie. */
    var mutating by mutableStateOf(false)
        private set

    fun updateCard(cardId: Int, zmiany: Map<String, JsonElement>, onDone: () -> Unit = {}) {
        zmien(
            akcja = {
                val zmieniona = api.updateCard(cardId, zmiany)
                currentSet?.let { zestaw ->
                    currentSet = zestaw.copy(cards = zestaw.cards.map { if (it.id == cardId) zmieniona else it })
                }
            },
            onDone = onDone,
        )
    }

    fun deleteCard(cardId: Int) = zmien({ currentSet = api.deleteCard(cardId) })

    /** Przesunięcie karty o [delta] pozycji. Backend chce pełnej permutacji,
     *  więc idzie cała lista identyfikatorów po zamianie. */
    fun moveCard(index: Int, delta: Int) {
        val karty = currentSet?.cards ?: return
        val cel = index + delta
        if (index !in karty.indices || cel !in karty.indices) return
        val kolejnosc = przesun(karty.map { it.id }, index, delta)
        val setId = currentSet?.id ?: return
        zmien({ currentSet = api.reorderCards(setId, kolejnosc) })
    }

    fun deleteSet(setId: Int) {
        zmien({
            api.deleteSet(setId)
            progress.clear(setId)
            sets = sets.filterNot { it.id == setId }
            currentSet = null
            screen = Screen.Sets
        })
    }

    private fun zmien(akcja: suspend () -> Unit, onDone: () -> Unit = {}) {
        if (mutating) return
        scope.launch {
            mutating = true
            error = null
            try {
                akcja()
                onDone()
            } catch (e: ApiException) {
                if (e.status == 401) onSessionExpired() else error = e.message
            } catch (e: Exception) {
                error = e.message ?: "Nie udało się zapisać zmiany."
            } finally {
                mutating = false
            }
        }
    }

    fun openBrowse() {
        screen = Screen.Browse
    }

    fun backToSetup() {
        screen = Screen.Setup
    }

    fun backToSets() {
        currentSet = null
        screen = Screen.Sets
    }

    /** 401 znaczy, że token wygasł albo został unieważniony wylogowaniem
     *  w innym kliencie — trzymanie go dłużej tylko myli użytkownika. */
    private fun onSessionExpired() {
        session.clear()
        sets = emptyList()
        screen = Screen.Login
        error = "Sesja wygasła, zaloguj się ponownie."
    }
}
