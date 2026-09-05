# /// script
# requires-python = ">=3.11"
# dependencies = ["mcp>=2"]
# ///
"""Serwer MCP dla Fiszek.

Wystawia API aplikacji jako narzędzia MCP, żeby model mógł czytać istniejące
zestawy i zakładać nowe bez ręcznego klejenia JSON-a i klikania w upload.
Rozmawia z tym samym publicznym API co przeglądarka — nie dotyka bazy ani
MinIO bezpośrednio, więc obowiązują te same reguły własności i autoryzacji.

Konfiguracja przez zmienne środowiskowe:

    FLASHCARDS_URL     adres aplikacji (domyślnie http://localhost:8000)
    FLASHCARDS_TOKEN   token sesji; w przeglądarce leży w
                       localStorage['flashcards.authToken']

Uruchomienie samodzielne (bez instalowania czegokolwiek):

    uv run --script mcp-server/server.py

Kontrola bez sieci i bez zależności:

    python3 mcp-server/server.py --self-check
"""

import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

BASE_URL = os.environ.get("FLASHCARDS_URL", "http://localhost:8000").rstrip("/")
TOKEN = os.environ.get("FLASHCARDS_TOKEN", "")
TIMEOUT = 60

# Specyfikacja formatu leży w repozytorium i jest jednocześnie pokazywana
# w aplikacji, więc serwer nie trzyma własnej kopii, która mogłaby się
# rozjechać z tamtą.
FORMAT_DOC = Path(__file__).resolve().parent.parent / "src" / "docs" / "set-format.md"


class ApiError(RuntimeError):
    pass


def reply(payload):
    """Serializuje odpowiedź narzędzia wyłącznie w ASCII.

    W mcp 2.x odpowiedź tools/call przepada po cichu — bez błędu, bez wpisu
    na stderr — gdy zawiera znak spoza ASCII albo znak nowej linii. Stąd
    ensure_ascii=True i brak indent; klient odkoduje sekwencje \\uXXXX
    z powrotem na polskie znaki. Z tego samego powodu docstringi narzędzi
    (trafiają do opisu w tools/list) są po angielsku, a specyfikacja formatu
    jedzie jako narzędzie, nie jako zasób.
    """
    return json.dumps(payload, ensure_ascii=True)


def _request(method, path, *, data=None, headers=None):
    if not TOKEN:
        raise ApiError(
            "Brak FLASHCARDS_TOKEN. Zaloguj się w aplikacji i skopiuj wartość "
            "localStorage['flashcards.authToken'] do tej zmiennej środowiskowej."
        )
    req = urllib.request.Request(f"{BASE_URL}{path}", data=data, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            body = res.read()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:400]
        if exc.code == 401:
            raise ApiError("401 — token wygasł lub jest nieprawidłowy. Zaloguj się ponownie i odśwież FLASHCARDS_TOKEN.") from exc
        raise ApiError(f"HTTP {exc.code} z {path}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise ApiError(f"Brak połączenia z {BASE_URL}: {exc.reason}") from exc


def build_multipart(fields, filename, file_bytes, field_name="file", content_type="application/json"):
    """Skleja ciało multipart/form-data. Zwraca (content_type, body).

    Endpoint POST /api/sets przyjmuje wyłącznie multipart z plikiem, więc
    serwer buduje go ręcznie — to jedyny powód, dla którego nie wystarcza
    czysty json.dumps.
    """
    boundary = f"----fiszki{uuid.uuid4().hex}"
    sep = f"--{boundary}".encode()
    parts = []
    for name, value in fields.items():
        if value is None:
            continue
        parts += [
            sep,
            f'Content-Disposition: form-data; name="{name}"'.encode(),
            b"",
            str(value).encode("utf-8"),
        ]
    parts += [
        sep,
        f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"'.encode(),
        f"Content-Type: {content_type}".encode(),
        b"",
        file_bytes,
        f"--{boundary}--".encode(),
        b"",
    ]
    return f"multipart/form-data; boundary={boundary}", b"\r\n".join(parts)


def _api_list_sets():
    return _request("GET", "/api/sets")


def _api_get_set(set_id):
    return _request("GET", f"/api/sets/{int(set_id)}")


def _validate_cards(cards):
    if not isinstance(cards, list) or not cards:
        raise ApiError("cards musi być niepustą listą obiektów kart")
    for i, card in enumerate(cards):
        if not isinstance(card, dict):
            raise ApiError(f"karta {i} nie jest obiektem")
        if not card.get("front") and not card.get("question"):
            raise ApiError(f"karta {i} nie ma pola front")


def _api_create_set(label, cards, category=None):
    _validate_cards(cards)
    payload = json.dumps(cards, ensure_ascii=False).encode("utf-8")
    content_type, body = build_multipart({"label": label, "category": category}, "set.json", payload)
    return _request("POST", "/api/sets", data=body, headers={"Content-Type": content_type})


def as_image_value(value):
    """Zamienia wartość obrazka na coś, co przyjmie backend.

    Ścieżka do istniejącego pliku idzie jako data URI — backend dekoduje ją
    i wrzuca do MinIO. Adres http(s) i gotowe data URI przechodzą bez zmian:
    pierwszy backend zapisze jako odnośnik zewnętrzny, drugi zdekoduje tak
    samo jak plik.
    """
    if value is None:
        return None
    if value.startswith(("http://", "https://", "data:")):
        return value
    path = Path(value).expanduser()
    if not path.is_file():
        raise ApiError(
            f"Nie znalazłem pliku {path}. Podaj ścieżkę do istniejącego obrazka, "
            "adres http(s) albo gotowe data URI."
        )
    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if not content_type.startswith("image/"):
        raise ApiError(f"{path.name} nie wygląda na obrazek (rozpoznany typ: {content_type}).")
    return f"data:{content_type};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def _api_update_card(card_id, fields):
    payload = {k: v for k, v in fields.items() if v is not None}
    if not payload:
        raise ApiError("Nie podano żadnego pola do zmiany.")
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return _request("PATCH", f"/api/cards/{int(card_id)}", data=body,
                    headers={"Content-Type": "application/json"})


def _api_add_cards(set_id, cards):
    _validate_cards(cards)
    body = json.dumps({"cards": cards}, ensure_ascii=False).encode("utf-8")
    return _request("POST", f"/api/sets/{int(set_id)}/cards", data=body,
                    headers={"Content-Type": "application/json"})


def _api_delete_set(set_id):
    _request("DELETE", f"/api/sets/{int(set_id)}")
    return {"deleted": int(set_id)}


def _guard(fn):
    """Zamienia ApiError w zwykłą odpowiedź. Wyjątek wypuszczony na zewnątrz
    zamieniłby się w komunikat błędu z polskim tekstem, a ten — jak wyżej —
    nie dotarłby do klienta wcale."""
    try:
        return reply(fn())
    except ApiError as exc:
        return reply({"error": str(exc)})


def self_check():
    """Sprawdza sklejanie multipartu — jedyny kawałek logiki, który może się
    po cichu zepsuć, a serwer nie ma testów integracyjnych."""
    content_type, body = build_multipart(
        {"label": "Zestaw testowy", "category": None},
        "set.json",
        b'[{"front":"a","back":"b"}]',
    )
    boundary = content_type.split("boundary=")[1]
    assert content_type.startswith("multipart/form-data; boundary=----fiszki"), content_type
    assert body.count(f"--{boundary}".encode()) == 3, "oczekiwano dwóch części i domknięcia"
    assert b'name="label"' in body and "Zestaw testowy".encode("utf-8") in body
    assert b'name="category"' not in body, "puste pola nie powinny trafiać do ciała"
    assert b'filename="set.json"' in body and b'"front":"a"' in body
    assert body.endswith(f"--{boundary}--\r\n".encode()), "brak domknięcia granicy"

    # Nagłówki części muszą być oddzielone od zawartości pustą linią (CRLF CRLF),
    # inaczej serwer widzi ciało jako część nagłówka.
    assert b"\r\n\r\n" in body

    for bad in ([], "nie lista", [{"back": "brak frontu"}]):
        try:
            _validate_cards(bad)
        except ApiError:
            pass
        else:  # pragma: no cover
            raise AssertionError(f"walidacja przepuściła {bad!r}")
    _validate_cards([{"question": "alias frontu też jest w porządku"}])

    assert FORMAT_DOC.exists(), f"brak specyfikacji formatu: {FORMAT_DOC}"

    # Nic poza ASCII nie może wyjść na stdio — patrz reply().
    out = reply({"format": FORMAT_DOC.read_text(encoding="utf-8")})
    out.encode("ascii")
    assert "Format zestawu fiszek" in json.loads(out)["format"]

    # as_image_value: plik idzie inline, adresy przechodzą bez zmian,
    # a nieistniejąca ścieżka kończy się czytelnym błędem, nie 400 z backendu.
    import tempfile

    png = bytes.fromhex("89504e470d0a1a0a")
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as fh:
        fh.write(png)
        tmp = fh.name
    assert as_image_value(tmp).startswith("data:image/png;base64,")
    assert base64.b64decode(as_image_value(tmp).split(",", 1)[1]) == png
    for passthrough in ("https://example.test/a.png", "data:image/jpeg;base64,AAAA"):
        assert as_image_value(passthrough) == passthrough
    assert as_image_value(None) is None
    for bad in (tmp + ".nie-ma", __file__):
        try:
            as_image_value(bad)
        except ApiError:
            pass
        else:  # pragma: no cover
            raise AssertionError(f"as_image_value przepuścił {bad!r}")
    os.unlink(tmp)

    blad = _guard(lambda: (_ for _ in ()).throw(ApiError("Zażółć gęślą jaźń")))
    blad.encode("ascii")
    assert json.loads(blad)["error"] == "Zażółć gęślą jaźń"

    print("self-check OK")


def main():
    # SDK 2.x: FastMCP nazywa się teraz MCPServer.
    from mcp.server.mcpserver import MCPServer

    mcp = MCPServer("fiszki")

    @mcp.tool()
    def list_sets() -> str:
        """List the signed-in user's sets: id, slug, label, category, card count.

        Start here before creating anything, so a new set does not duplicate
        material that already exists.
        """
        return _guard(lambda: {"sets": _api_list_sets()})

    @mcp.tool()
    def get_set(set_id: int) -> str:
        """Fetch one set with all of its cards.

        Useful when new material should match the style, language and level of
        detail of an existing set.
        """
        return _guard(lambda: _api_get_set(set_id))

    @mcp.tool()
    def create_set(label: str, cards: list[dict], category: str | None = None) -> str:
        """Create a new set from a list of cards.

        `cards` follows the format returned by set_format - read that first,
        because besides plain front/back cards there are multiple-choice and
        matching cards. The minimal card is {"front": "...", "back": "..."}.

        Use add_cards to append to an existing set and update_card to edit a
        single card; this tool always creates a new set.
        """
        return _guard(lambda: _api_create_set(label, cards, category))

    @mcp.tool()
    def add_cards(set_id: int, cards: list[dict]) -> str:
        """Append cards to the end of an existing set and return the whole set.

        The set keeps its id and slug, so links and saved round progress stay
        valid — unlike deleting and recreating it. Cards use the same format as
        create_set; call set_format if you have not read it yet.
        """
        return _guard(lambda: _api_add_cards(set_id, cards))

    @mcp.tool()
    def update_card(
        card_id: int,
        front: str | None = None,
        back: str | None = None,
        symbols: str | None = None,
        front_image: str | None = None,
        back_image: str | None = None,
        clear_front_image: bool = False,
        clear_back_image: bool = False,
    ) -> str:
        """Edit one existing card in place, without touching the rest of the set.

        Card ids come from get_set. Only the arguments you pass are changed.

        `front_image` / `back_image` accept a path to a local image file (it is
        read and sent inline, the backend stores it and deletes the object it
        replaced), an http(s) URL, or a ready data URI. Pass
        clear_front_image / clear_back_image to remove an image instead.
        """
        def run():
            fields = {
                "front": front,
                "back": back,
                "symbols": symbols,
                "frontImage": None if clear_front_image else as_image_value(front_image),
                "backImage": None if clear_back_image else as_image_value(back_image),
            }
            if clear_front_image:
                fields["frontImage"] = ""
            if clear_back_image:
                fields["backImage"] = ""
            return _api_update_card(card_id, fields)
        return _guard(run)

    @mcp.tool()
    def delete_set(set_id: int) -> str:
        """Delete a set together with its cards and images.

        Irreversible - ask the user before calling this.
        """
        return _guard(lambda: _api_delete_set(set_id))

    @mcp.tool()
    def set_format() -> str:
        """Return the full set format specification: card fields, LaTeX rules,
        images, multiple-choice cards and matching cards.

        Read it once per conversation before the first create_set. It is a tool
        rather than an MCP resource on purpose - the document is written in
        Polish, and resource payloads cannot carry non-ASCII text here.
        """
        return _guard(lambda: {"format": FORMAT_DOC.read_text(encoding="utf-8")})

    mcp.run()


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        self_check()
    else:
        main()
