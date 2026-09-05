# Serwer MCP dla Fiszek

Wystawia API aplikacji jako narzędzia MCP, żeby model mógł czytać istniejące
zestawy i zakładać nowe bez ręcznego sklejania JSON-a i klikania w upload.
Rozmawia z tym samym publicznym API co przeglądarka — nie dotyka bazy ani
MinIO bezpośrednio, więc obowiązują te same reguły własności i autoryzacji.

## Narzędzia

| Narzędzie | Co robi |
|---|---|
| `list_sets` | lista zestawów zalogowanego użytkownika: id, slug, etykieta, kategoria, liczba kart |
| `get_set(set_id)` | jeden zestaw wraz ze wszystkimi kartami |
| `create_set(label, cards, category)` | zakłada zestaw z listy kart |
| `delete_set(set_id)` | kasuje zestaw wraz z kartami i obrazkami |
| `set_format()` | pełna specyfikacja formatu karty (`src/docs/set-format.md`) |

Dopisywania kart do istniejącego zestawu **nie ma**, bo API nie ma takiego
endpointu — `create_set` dostaje komplet kart w jednym wywołaniu.

## Uruchomienie

Zależności ciągnie `uv` z nagłówka PEP 723 w samym skrypcie, więc nie trzeba
niczego instalować ani zakładać wirtualnego środowiska.

W repozytorium leży `.mcp.json`, który Claude Code podchwytuje sam. Wystarczy
token:

```bash
export FLASHCARDS_TOKEN='...'      # localStorage['flashcards.authToken'] z przeglądarki
```

Domyślnie serwer gada z `http://localhost:8000`, czyli z lokalnym backendem
z `docker compose`. Produkcja:

```bash
export FLASHCARDS_URL=https://fiszki-14m94kaf77.byst.re
```

Token wygasa po 30 dniach (`session_ttl_days`) i po wylogowaniu w aplikacji —
wtedy narzędzia zwrócą `401` z prośbą o odświeżenie zmiennej.

Samodzielnie, poza Claude Code:

```bash
uv run --script mcp-server/server.py     # serwer stdio
python3 mcp-server/server.py --self-check    # kontrola bez sieci i bez zależności
```

## Ograniczenia mcp 2.x, o które trzeba się tu obijać

Sprawdzone empirycznie na tej wersji SDK. Odpowiedź `tools/call` **przepada
po cichu** — bez błędu, bez wpisu na stderr, klient po prostu nigdy nie
dostaje wyniku — gdy:

- wynik narzędzia zawiera znak spoza ASCII,
- wynik zawiera znak nowej linii (czyli `json.dumps(..., indent=...)` psuje wszystko),
- docstring narzędzia zawiera znak spoza ASCII (opis trafia do `tools/list`).

Dlatego w `server.py`: wszystko idzie przez `reply()` z `ensure_ascii=True`
i bez `indent`, docstringi narzędzi są po angielsku, a błędy wracają jako
zwykła odpowiedź `{"error": ...}` zamiast wyjątku. Klient odkoduje sekwencje
`\uXXXX` z powrotem na polskie znaki, więc treść nic nie traci.

Z tego samego powodu specyfikacja formatu jedzie jako **narzędzie**, a nie
zasób MCP: zasoby oddają surowy tekst, a dokument jest po polsku. Dodatkowo
podanie `mime_type=` przy `@mcp.resource` sprawia, że `resources/read`
w ogóle nie odpowiada.

Gdy SDK to naprawi, `ensure_ascii` i angielskie docstringi można będzie
cofnąć — `--self-check` pilnuje samego kontraktu, nie tych obejść.
