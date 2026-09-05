# Fiszki — klient mobilny (Kotlin Multiplatform)

Compose Multiplatform na wspólnym kodzie: Android buduje się i działa, cele
iOS są zadeklarowane, ale wymagają macOS z Xcode.

Aplikacja rozmawia z tym samym publicznym API co przeglądarka i serwer MCP —
nie ma własnego backendu ani własnej bazy.

## Co działa

- logowanie kodem z e-maila (te same dwa kroki co w webie),
- lista zestawów zalogowanego użytkownika,
- runda nauki: karta, odwrócenie, ocena „umiem" / „jeszcze nie umiem",
  licznik opanowanych, kolejna runda z resztą,
- obrazki kart (endpoint jest za bearerem, więc bajty pobiera klient API,
  a dekoduje `decodeToImageBitmap`),
- **wzory LaTeX** — tym samym KaTeX-em co w webie, wczytanym z zasobów
  aplikacji (patrz niżej).

## Czego jeszcze nie ma

- **karty wyboru** — pytania z odpowiedziami a/b/c/d pokazują się jako tekst,
  bez klikalnych opcji (web parsuje je z treści karty).
- **tryb offline** — wszystko idzie z sieci przy każdym uruchomieniu.
- **edycja** — kart i zestawów nie da się tu zmieniać; od tego jest web i MCP.

## Wzory

Karta bez wzoru renderuje się zwykłym `Text` — to większość kart, jest szybciej
i tekst daje się zaznaczać. Dopiero obecność wzoru uruchamia widok platformy
z KaTeX-em: na Androidzie `WebView`, na iOS `WKWebView`.

Za wzór uchodzą dopiero **dwa** nieucieczkowane znaki dolara, żeby cena w rodzaju
„koszt 5$" nie ładowała ciężkiego widoku. Treść karty jest escapowana — poza
dolarami, bo po nich KaTeX rozpoznaje wzory — więc karta nie wstrzyknie
znaczników do dokumentu.

KaTeX leży w `composeApp/src/androidMain/assets/katex/`: `katex.min.js`,
`auto-render.min.js`, `katex.min.css` i 20 fontów `woff2`, razem ok. 590 kB.
Pochodzą z tej samej wersji, której używa web (`katex` w `package.json`), więc
wzór wygląda tak samo w obu klientach i nie ma drugiego renderera do
utrzymania. Nic nie idzie po sieci.

`WebView` w przewijanej kolumnie nie potrafi dopasować wysokości do treści,
więc strona po wyrenderowaniu i po dociągnięciu fontów raportuje własną
wysokość mostem JavaScriptu (`AndroidPomiar`), a composable ustawia ją jako
wysokość widoku.

**Do sprawdzenia na urządzeniu:** most pomiaru wysokości oraz wczytywanie
zasobów z `file:///android_asset/` przy `allowFileAccess = false`. Dokumentacja
mówi, że zasoby i tak pozostają dostępne, ale to jedyne miejsce tej zmiany,
którego nie potwierdziłem uruchomieniem. Sam dokument HTML wraz z renderowaniem
wzorów sprawdziłem w przeglądarce.

## Budowanie

```bash
cd mobile
./gradlew :composeApp:testDebugUnitTest    # testy logiki i klienta API
./gradlew :composeApp:assembleDebug        # APK w composeApp/build/outputs/apk/debug/
```

Wymaga JDK 21 i Android SDK 35. `local.properties` ze `sdk.dir` jest poza
repozytorium — Android Studio tworzy je samo, w CI wystarcza `ANDROID_HOME`.

Wersje pilnowane w `gradle/libs.versions.toml`: Kotlin 2.2.0, Compose
Multiplatform 1.8.2, AGP 8.13.2, Ktor 3.1.3, Gradle 8.14.3.

**Ktor stoi na 3.1.3 celowo.** Przy 3.2.0 `mergeExtDexDebug` wywala się na
`ktor-client-core-jvm`: D8 odrzuca klasę o nazwie ze spacjami (`use streaming
syntax`) przy DEX niższym niż 040. Podniesienie wersji wymaga sprawdzenia,
czy problem zniknął — nie samego bumpa.

## Serwer

Domyślnie produkcja: `https://fiszki-14m94kaf77.byst.re`. Adres zmienia się na
ekranie logowania (przycisk **Serwer**) i zapisuje w ustawieniach urządzenia.
Emulator Androida widzi lokalny backend pod `http://10.0.2.2:8000`, nie
`localhost`.

## Układ kodu

```
composeApp/src/
  commonMain/kotlin/pl/fiszki/
    Api.kt            klient HTTP; ApiException niesie kod odpowiedzi
    Model.kt          modele odpowiedzi API
    Session.kt        token, e-mail i adres serwera w ustawieniach platformy
    StudySession.kt   przebieg rundy — czysta logika, bez sieci i Compose'a
    AppState.kt       stan aplikacji i przejścia między ekranami
    App.kt            motyw i wybór ekranu
    LoginScreen.kt / SetsScreen.kt / StudyScreen.kt / RemoteImage.kt
  androidMain/        MainActivity, manifest, motyw startowy
  iosMain/            MainViewController (buduje się tylko na macOS)
  commonTest/         testy StudySession i klienta API na MockEngine
```

Nawigacji nie ma jako biblioteki — ekrany są trzy, więc `sealed interface Screen`
w `AppState` wystarcza i nie dokłada zależności.

## Uwaga o tokenie

Token sesji leży w `SharedPreferences` (Android) i `NSUserDefaults` (iOS),
chronionych piaskownicą aplikacji — tyle samo, ile daje `localStorage`
w kliencie webowym. Jeśli aplikacja zacznie trzymać coś więcej niż token do
własnych fiszek, warto przenieść go do `EncryptedSharedPreferences` i Keychainu.
