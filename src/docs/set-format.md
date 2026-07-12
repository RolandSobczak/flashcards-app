# Format zestawu fiszek — specyfikacja dla LLM

Poniższy dokument opisuje dokładny format pliku JSON (lub ZIP), który
aplikacja *Fiszki* potrafi zaimportować. Wklej ten plik w całości do
rozmowy z dowolnym modelem językowym razem z notatkami/tematem, z
którego mają powstać fiszki, i poproś o wygenerowanie zestawu zgodnego
z tym formatem.

Na końcu dokumentu znajduje się gotowe polecenie do skopiowania.

## 1. Ogólna struktura

Najprostszy akceptowany plik to zwykły plik `.json` zawierający
**tablicę obiektów kart** — jedna karta = jeden obiekt:

```json
[
  { "front": "...", "back": "..." },
  { "front": "...", "back": "..." }
]
```

Tablica nie może być pusta. Kolejność elementów w tablicy = kolejność
kart w zestawie. Pole `id` nie jest wymagane (i jest ignorowane, jeśli
występuje) — numeracja bierze się z pozycji w tablicy.

Aplikacja obsługuje też import/eksport całego zestawu jako plik
`.zip` — patrz sekcja 7.

## 2. Wspólne pola karty

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `front` | string | tak | Treść przedniej strony (pytanie). Aliasu `question` też można użyć zamiast `front`. |
| `back` | string | tak* | Treść tylnej strony (odpowiedź). Alias: `answer`. *Dla kart typu "dopasowanie" (matching) pole jest opcjonalne — patrz sekcja 6. |
| `frontImage` | string \| null | nie | Obrazek do przedniej strony. Alias: `image`. Format wartości — patrz sekcja 4. |
| `backImage` | string \| null | nie | Obrazek do tylnej strony. |
| `symbols` | string \| null | nie | Dodatkowa legenda pokazywana pod tylną stroną, wpisy oddzielone średnikiem `;`, np. `"A - napięcie wejściowe; B - napięcie wyjściowe"`. |
| `matching` | object \| null | nie | Obecność tego pola zamienia kartę w ćwiczenie "dopasuj pary" — patrz sekcja 6. |

Każde inne, nierozpoznane pole w obiekcie karty jest po prostu
ignorowane — nie trzeba się go pozbywać, ale też nie ma sensu go
dodawać.

### Tekst i LaTeX

- `front`/`back`/`symbols` obsługują LaTeX: `$...$` dla wzorów w
  linii, `$$...$$` dla wzorów wyśrodkowanych, renderowane przez KaTeX
  (obsługuje standardowe polecenia typu `\frac`, `\overline`,
  `\oplus`, `\odot`, `\Rightarrow`, `\bar{}` itd.).
- W pliku JSON każdy `\` w LaTeX-u musi być zapisany jako `\\`
  (standardowe escapowanie JSON), np. `"front": "$$\\frac{1}{2}$$"`.
- Prawdziwe znaki nowej linii `\n` w tekście są zachowywane wizualnie
  (każda karta renderuje tekst z zachowaniem łamania linii).

## 3. Zwykła fiszka (flashcard)

Najprostszy typ karty — front/przód, kliknięcie odwraca na back/tył.

```json
{
  "front": "Jak nazywa się prawo mówiące, że $\\overline{A \\cdot B} = \\bar{A} + \\bar{B}$?",
  "back": "Prawo De Morgana.\n\nDziała symetrycznie także dla sumy: $\\overline{A + B} = \\bar{A} \\cdot \\bar{B}$.",
  "symbols": "A, B - zmienne logiczne"
}
```

## 4. Obrazki

Wartość `frontImage`/`backImage` może być jedną z poniższych form:

1. **Data URI (base64)** — obrazek osadzony bezpośrednio w JSON-ie,
   zostanie automatycznie wypakowany i zapisany po stronie serwera:
   `"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..."`
   Obsługiwane typy: PNG, JPEG, GIF, WEBP, SVG.
2. **Sam base64 bez prefiksu** — traktowany jak PNG:
   `"iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..."`
3. **Zewnętrzny URL** — zaczyna się od `http://` lub `https://`,
   zapisywany "jak jest" (bez pobierania na serwer):
   `"https://example.com/wykres.png"`
4. **Ścieżka lokalna** — zaczyna się od `/` lub `./`, przydatne tylko
   jeśli plik faktycznie jest hostowany przez frontend (np. w
   `public/`): `"/images/wykres.png"`
5. **Ścieżka względna w archiwum ZIP** — tylko przy imporcie z pliku
   `.zip` (sekcja 7): `"images/0-front.png"`

Jeśli karta nie ma obrazka, pole można pominąć albo ustawić na `null`.

## 5. Pytanie zamknięte / ABCD (MCQ)

Nie ma osobnego pola dla tego typu — aplikacja rozpoznaje go po
**formacie tekstu** w `front` i `back`:

- W `front` po treści pytania każda opcja jest w osobnej linii, w
  formacie `a) tekst`, `b) tekst`, ... (litery od `a` do `d`,
  minimum 2 opcje).
- `back` musi **zaczynać się dokładnie** od `**<litera>)` (bez pustej
  linii/spacji przed `**`) — to oznacza poprawną odpowiedź. Reszta
  `back` po tym znaczniku to wyjaśnienie pokazywane po udzieleniu
  odpowiedzi.

```json
{
  "front": "Które prawo pozwala zamienić $\\overline{A \\cdot B}$ na sumę negacji?\na) Prawo przemienności\nb) Prawo De Morgana\nc) Prawo pochłaniania\nd) Prawo podwójnej negacji",
  "back": "**b) Prawo De Morgana**\n\nPrawo De Morgana mówi, że $\\overline{A \\cdot B} = \\bar{A} + \\bar{B}$."
}
```

## 6. Dopasowanie par (matching)

Dodanie pola `matching` zamienia kartę w ćwiczenie z przeciąganiem —
użytkownik dopasowuje elementy z prawej kolumny do lewej.

- `matching.pairs` — tablica dwuelementowych par
  `["lewa strona", "prawa strona"]`. Zalecane 3–8 par.
- `front` to polecenie/pytanie pokazywane nad listą.
- `back` jest **opcjonalne** — jeśli podane, pokazuje się jako
  wyjaśnienie po sprawdzeniu odpowiedzi.

```json
{
  "front": "Dopasuj bramkę logiczną do jej symbolu działania.",
  "matching": {
    "pairs": [
      ["AND", "$A \\cdot B$"],
      ["OR", "$A + B$"],
      ["XOR", "$A \\oplus B$"],
      ["NOT", "$\\bar{A}$"]
    ]
  },
  "back": "To podstawowe bramki logiczne używane do budowy układów cyfrowych."
}
```

## 7. Format ZIP (import/eksport całego zestawu)

Zamiast pojedynczego pliku `.json` można zaimportować/wyeksportować
zestaw jako `.zip` o następującej strukturze:

```
moj-zestaw.zip
├── set.json          (albo: cards.json)
└── images/
    ├── 0-front.png
    ├── 2-back.jpg
    └── ...
```

`set.json` może być albo samą tablicą kart (jak w sekcji 1), albo
obiektem z metadanymi:

```json
{
  "label": "Nazwa zestawu",
  "category": "Opcjonalna kategoria",
  "cards": [
    { "front": "...", "back": "...", "frontImage": "images/0-front.png" }
  ]
}
```

Pliki w folderze `images/` są referencjonowane z poziomu
`frontImage`/`backImage` jako **ścieżka względna** (patrz punkt 5 w
sekcji 4). Dokładnie taki format produkuje przycisk eksportu zestawu w
aplikacji (menu → ikona pobierania przy zestawie), więc pobrany plik
zawsze da się bez zmian zaimportować z powrotem.

## 8. Pełny przykładowy plik

```json
[
  {
    "front": "Stolica Polski?",
    "back": "Warszawa"
  },
  {
    "front": "Która funkcja w Pythonie zwraca długość listy?\na) size(lista)\nb) len(lista)\nc) length(lista)\nd) count(lista)",
    "back": "**b) len(lista)**\n\nlen() działa na listach, krotkach, stringach i słownikach."
  },
  {
    "front": "Dopasuj kraj do jego stolicy.",
    "matching": {
      "pairs": [
        ["Polska", "Warszawa"],
        ["Francja", "Paryż"],
        ["Japonia", "Tokio"]
      ]
    }
  }
]
```

## 9. Częste błędy, których trzeba unikać

- Niepoprawny JSON (przecinek na końcu tablicy/obiektu, brak cudzysłowów,
  komentarze) — plik musi być czystym, poprawnym JSON-em.
- Niezescapowane `\` w LaTeX-u (musi być `\\`).
- `back` dla MCQ zaczynający się od spacji/nowej linii przed `**` —
  wtedy karta NIE zostanie rozpoznana jako pytanie zamknięte i wyświetli
  się jako zwykła fiszka z surowym tekstem markera.
- Mniej niż 2 opcje `a)`/`b)` w `front` — z tego samego powodu karta
  nie zostanie rozpoznana jako MCQ.
- Pusta tablica kart na najwyższym poziomie.

---

## Gotowe polecenie do wklejenia razem z tym plikiem

> Wygeneruj zestaw fiszek w formacie JSON opisanym powyżej, na temat:
> **[tutaj wpisz swój temat / wklej notatki]**.
> Użyj mieszanki typów kart (zwykłe fiszki, pytania zamknięte ABCD,
> dopasowanie par) tam, gdzie to sensowne. Zwróć wyłącznie poprawny
> JSON — samą tablicę kart, bez dodatkowego komentarza ani bloku
> markdown wokół niego.
