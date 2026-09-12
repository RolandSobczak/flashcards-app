"""Logowanie narzędzia przez zatwierdzenie w przeglądarce.

Narzędzie bez przeglądarki (CLI, serwer MCP) nie ma jak przejść logowania
kodem z maila — kod dostaje człowiek, nie proces. Zamiast przeklejania
tokenu sesji z localStorage narzędzie zakłada żądanie i pokazuje krótki kod;
człowiek otwiera je w zalogowanej przeglądarce i zatwierdza, a narzędzie
odbiera własny token. To ten sam pomysł co OAuth device flow, w rozmiarze
tej aplikacji.

Moduł stoi osobno i bez zależności, żeby dało się go sprawdzić samym
`python backend/deviceflow.py`, bez bazy i bez serwera.
"""

import secrets
from datetime import datetime

# Bez 0/O, 1/I/L — kod bywa przepisywany ręcznie z terminala do przeglądarki.
ALFABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

PENDING = "pending"
APPROVED = "approved"
DENIED = "denied"
EXPIRED = "expired"


def generuj_kod_uzytkownika() -> str:
    """Kod pokazywany człowiekowi, w formacie XXXX-XXXX."""
    znaki = "".join(secrets.choice(ALFABET) for _ in range(8))
    return f"{znaki[:4]}-{znaki[4:]}"


def normalizuj_kod(raw: str) -> str:
    """Kod z adresu albo z ręki sprowadzony do postaci kanonicznej.

    Wielkość liter i myślnik nie niosą treści, a człowiek przepisuje kod
    z terminala — bez tego „abcd efgh" byłoby innym kodem niż „ABCD-EFGH".
    """
    znaki = [z for z in raw.upper() if z.isalnum()]
    if len(znaki) != 8:
        return ""
    kod = "".join(znaki)
    if any(z not in ALFABET for z in kod):
        return ""
    return f"{kod[:4]}-{kod[4:]}"


def status(
    approved_at: datetime | None,
    denied_at: datetime | None,
    expires_at: datetime,
    now: datetime,
) -> str:
    """Stan żądania.

    Termin ważności obowiązuje także po zatwierdzeniu: token, po który nikt
    nie przyszedł na czas, przepada razem z żądaniem. Odmowa jest ostateczna
    i wygaśnięcie jej nie zmienia — narzędzie ma zobaczyć, że człowiek
    powiedział „nie", a nie że „za późno".
    """
    if denied_at is not None:
        return DENIED
    if expires_at <= now:
        return EXPIRED
    if approved_at is not None:
        return APPROVED
    return PENDING


def _self_check() -> None:
    kod = generuj_kod_uzytkownika()
    assert len(kod) == 9 and kod[4] == "-", kod
    assert all(z in ALFABET for z in kod.replace("-", "")), kod
    assert len({generuj_kod_uzytkownika() for _ in range(200)}) > 190  # losowy, nie licznik

    assert normalizuj_kod("abcd-efgh") == "ABCD-EFGH"
    assert normalizuj_kod("  abcd efgh ") == "ABCD-EFGH"
    assert normalizuj_kod("ABCDEFGH") == "ABCD-EFGH"
    assert normalizuj_kod("ABC-EFGH") == ""          # za krótki
    assert normalizuj_kod("ABCD-EFG0") == ""         # zero nie należy do alfabetu
    assert normalizuj_kod("") == ""

    teraz = datetime(2026, 9, 12, 12, 0, 0)
    pozniej = datetime(2026, 9, 12, 12, 10, 0)
    wczesniej = datetime(2026, 9, 12, 11, 50, 0)

    assert status(None, None, pozniej, teraz) == PENDING
    assert status(teraz, None, pozniej, teraz) == APPROVED
    assert status(None, teraz, pozniej, teraz) == DENIED
    assert status(None, None, wczesniej, teraz) == EXPIRED
    # Zatwierdzone, ale nieodebrane na czas — przepada.
    assert status(wczesniej, None, wczesniej, teraz) == EXPIRED
    # Odmowa zostaje odmową także po terminie.
    assert status(None, wczesniej, wczesniej, teraz) == DENIED
    print("deviceflow: OK")


if __name__ == "__main__":
    _self_check()
