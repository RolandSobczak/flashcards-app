"""Rozpoznawanie odwołań do obrazków, których nie da się wczytać.

Karta może podać obrazek na cztery sposoby: dane w treści (`data:` albo samo
base64), plik w paczce ZIP obok `set.json` oraz adres w internecie. Piąta
forma — ścieżka w rodzaju `/horla_figures/x.png` — wygląda niewinnie, a jest
pułapką: wskazuje plik statyczny konkretnego frontu. Zestaw z takim
odwołaniem daje się wyeksportować i zaimportować gdzie indziej, ale obrazka
tam nie ma; SPA oddaje pod tym adresem swój HTML, więc karta pokazuje
zepsuty obrazek zamiast błędu.

Moduł stoi osobno i bez zależności, żeby dało się go sprawdzić samym
`python backend/imageref.py`, bez bazy i bez MinIO.
"""

ADRESY = ("http://", "https://")


def obraz_nie_do_wczytania(value: str | None, rozpoznany: bool) -> bool:
    """Czy odwołanie do obrazka trzeba odrzucić.

    `rozpoznany` mówi, czy udało się już wyciągnąć bajty obrazka — z paczki
    albo z danych w treści. Jeśli nie, zostaje wyłącznie adres http(s);
    wszystko inne wskazuje plik, którego zapisany zestaw nie zabierze ze sobą.
    """
    if not value or rozpoznany:
        return False
    return not value.startswith(ADRESY)


def _self_check() -> None:
    # Wczytane z paczki albo z data URI — nie ma czego odrzucać.
    assert obraz_nie_do_wczytania("images/12-front.jpg", True) is False
    assert obraz_nie_do_wczytania("data:image/png;base64,AAAA", True) is False
    assert obraz_nie_do_wczytania("iVBORw0KGgo=", True) is False

    # Adres zostaje adresem, choćby i nic z niego nie wczytano.
    assert obraz_nie_do_wczytania("https://example.test/a.png", False) is False

    # Ścieżka do pliku statycznego frontu i literówka w nazwie z paczki:
    # jedno i drugie zapisałoby się jako odnośnik do niczego.
    assert obraz_nie_do_wczytania("/horla_figures/q11.png", False) is True
    assert obraz_nie_do_wczytania("./rysunek.png", False) is True
    assert obraz_nie_do_wczytania("images/12-fornt.jpg", False) is True

    assert obraz_nie_do_wczytania(None, False) is False
    assert obraz_nie_do_wczytania("", False) is False
    print("imageref: OK")


if __name__ == "__main__":
    _self_check()
