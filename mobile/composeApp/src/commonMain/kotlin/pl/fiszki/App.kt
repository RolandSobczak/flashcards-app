package pl.fiszki

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.russhwolf.settings.Settings

private val ciemny = darkColorScheme(
    primary = Color(0xFF6366F1),
    onPrimary = Color.White,
    surface = Color(0xFF1A1A28),
    onSurface = Color(0xFFE2E2F0),
    surfaceVariant = Color(0xFF1E1E30),
    onSurfaceVariant = Color(0xFF9090B0),
    background = Color(0xFF0F0F13),
    onBackground = Color(0xFFE2E2F0),
    error = Color(0xFFF87171),
)

@Composable
fun App(settings: Settings) {
    val scope = rememberCoroutineScope()
    val state = remember { AppState(SessionStore(settings), scope) }

    MaterialTheme(colorScheme = ciemny) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Box(Modifier.fillMaxSize()) {
                when (val screen = state.screen) {
                    is Screen.Login -> LoginScreen(state)
                    is Screen.Sets -> SetsScreen(state)
                    is Screen.Study -> StudyScreen(state, screen.set)
                }
            }
        }
    }
}
