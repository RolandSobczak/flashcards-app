package pl.fiszki

import androidx.compose.ui.window.ComposeUIViewController
import com.russhwolf.settings.NSUserDefaultsSettings
import platform.Foundation.NSUserDefaults

/** Punkt wejścia dla iOS. Zbudowanie tego wymaga macOS z Xcode — na innych
 *  systemach cel istnieje po to, żeby kod wspólny nie rozjechał się z iOS-em. */
fun MainViewController() = ComposeUIViewController {
    App(NSUserDefaultsSettings(NSUserDefaults.standardUserDefaults))
}
