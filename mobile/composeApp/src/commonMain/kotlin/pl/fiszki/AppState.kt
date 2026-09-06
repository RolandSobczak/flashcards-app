package pl.fiszki

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

sealed interface Screen {
    data object Login : Screen
    data object Sets : Screen
    data class Setup(val set: SetDetail) : Screen
    data class Study(val set: SetDetail, val session: StudySession) : Screen
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
                screen = Screen.Setup(api.getSet(summary.id))
            } catch (e: ApiException) {
                if (e.status == 401) onSessionExpired() else error = e.message
            } catch (e: Exception) {
                error = e.message ?: "Nie udało się otworzyć zestawu."
            } finally {
                loading = false
            }
        }
    }

    fun startStudy(set: SetDetail, session: StudySession) {
        screen = Screen.Study(set, session)
    }

    fun backToSetup(set: SetDetail) {
        screen = Screen.Setup(set)
    }

    fun backToSets() {
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
