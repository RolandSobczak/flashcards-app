import io
import json
import re
import zipfile

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from minio.error import S3Error
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import storage
from .auth import get_current_user
from .db import get_db
from .models import CardModel, SetModel, UserModel
from .schemas import CardOrderIn, CardOut, CardsIn, CardUpdate, SetDetail, SetSummary

router = APIRouter(prefix="/api", tags=["sets"])


def _slugify(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    return slug or "set"


def _unique_slug(db: Session, label: str) -> str:
    base = _slugify(label)
    slug = base
    n = 2
    while db.scalar(select(SetModel.id).where(SetModel.slug == slug)) is not None:
        slug = f"{base}-{n}"
        n += 1
    return slug


def _normalize_card(raw: dict) -> dict:
    return {
        "front": raw.get("front") or raw.get("question") or "",
        "back": raw.get("back") or raw.get("answer") or "",
        "frontImage": raw.get("frontImage") or raw.get("image"),
        "backImage": raw.get("backImage"),
        "symbols": raw.get("symbols"),
        "matching": raw.get("matching"),
    }


def _card_image_url(key: str | None, external_url: str | None) -> str | None:
    if key:
        return f"/api/images/{key}"
    return external_url


def _card_out(card: CardModel) -> CardOut:
    return CardOut(
        id=card.id,
        position=card.position,
        front=card.front,
        back=card.back,
        symbols=card.symbols,
        matching=card.matching,
        frontImage=_card_image_url(card.front_image_key, card.front_image_url),
        backImage=_card_image_url(card.back_image_key, card.back_image_url),
    )


def _store_image(
    value: str | None, set_id: int, position: int, side: str, zf: zipfile.ZipFile | None = None
) -> tuple[str | None, str | None]:
    """Returns (object_key, external_url) — embedded image data (or an image
    file referenced by a relative path inside an imported zip) is pushed to
    MinIO (object_key set); anything else that isn't empty (an http URL, a
    local /public path, ...) is kept as-is (external_url set) so it isn't
    silently dropped."""
    if zf is not None and value and value in zf.namelist():
        content_type = storage.content_type_for_filename(value)
        key = storage.object_key(set_id, position, side, content_type)
        storage.upload_image(key, storage.DecodedImage(data=zf.read(value), content_type=content_type))
        return key, None

    decoded = storage.decode_image(value)
    if decoded:
        key = storage.object_key(set_id, position, side, decoded.content_type)
        storage.upload_image(key, decoded)
        return key, None
    return None, (value or None)


def _is_zip(raw: bytes, filename: str | None) -> bool:
    if filename and filename.lower().endswith(".zip"):
        return True
    return raw[:2] == b"PK"


def _load_zip_payload(raw: bytes) -> tuple[zipfile.ZipFile, list | dict]:
    try:
        zf = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")

    json_names = [n for n in zf.namelist() if n.lower().endswith(".json")]
    preferred = next((n for n in json_names if n.lower() in ("set.json", "cards.json")), None)
    name = preferred or (json_names[0] if json_names else None)
    if name is None:
        raise HTTPException(status_code=400, detail="Zip file has no JSON set data")

    try:
        payload = json.loads(zf.read(name))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON inside zip file")
    return zf, payload


@router.get("/sets", response_model=list[SetSummary])
def list_sets(db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    sets = db.scalars(
        select(SetModel).where(SetModel.owner_id == user.id).order_by(SetModel.created_at.desc())
    ).all()
    return [
        SetSummary(
            id=s.id,
            slug=s.slug,
            label=s.label,
            category=s.category,
            cardCount=len(s.cards),
            createdAt=s.created_at,
        )
        for s in sets
    ]


@router.get("/sets/{set_id}", response_model=SetDetail)
def get_set(set_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    # Any logged-in user can open a set by id (not just its owner) — that's
    # what makes "share this set by sending a link" possible once the app
    # grows real deep-linking; for now it's reachable by anyone who knows
    # the id and has an account.
    s = db.get(SetModel, set_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Set not found")
    return _set_detail(s)


def _export_image_ref(
    zf: zipfile.ZipFile, key: str | None, external_url: str | None, position: int, side: str
) -> str | None:
    if not key:
        return external_url
    try:
        response = storage.get_object(key)
    except S3Error:
        return external_url
    try:
        data = response.read()
    finally:
        response.close()
        response.release_conn()

    ext = key.rsplit(".", 1)[-1] if "." in key else "bin"
    arcname = f"images/{position}-{side}.{ext}"
    zf.writestr(arcname, data)
    return arcname


@router.get("/sets/{set_id}/export")
def export_set(set_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    s = db.get(SetModel, set_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Set not found")
    if s.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Nie jesteś właścicielem tego zestawu")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        cards = [
            {
                "front": c.front,
                "back": c.back,
                "symbols": c.symbols,
                "matching": c.matching,
                "frontImage": _export_image_ref(zf, c.front_image_key, c.front_image_url, c.position, "front"),
                "backImage": _export_image_ref(zf, c.back_image_key, c.back_image_url, c.position, "back"),
            }
            for c in s.cards
        ]
        payload = {"label": s.label, "category": s.category, "cards": cards}
        zf.writestr("set.json", json.dumps(payload, ensure_ascii=False, indent=2))

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{s.slug}.zip"'},
    )


@router.post("/sets", response_model=SetDetail, status_code=201)
async def create_set(
    file: UploadFile,
    label: str = Form(...),
    category: str | None = Form(None),
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    raw_bytes = await file.read()
    label = label.strip()
    zf: zipfile.ZipFile | None = None

    if _is_zip(raw_bytes, file.filename):
        zf, payload = _load_zip_payload(raw_bytes)
        if isinstance(payload, dict):
            raw_cards = payload.get("cards")
            label = label or payload.get("label") or file.filename or "Zestaw"
            category = category or payload.get("category")
        else:
            raw_cards = payload
            label = label or file.filename or "Zestaw"
    else:
        try:
            raw_cards = json.loads(raw_bytes)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON file")
        label = label or file.filename or "Zestaw"

    if not isinstance(raw_cards, list) or not raw_cards:
        raise HTTPException(status_code=400, detail="Expected a non-empty JSON array of cards")

    slug = _unique_slug(db, label)

    db_set = SetModel(slug=slug, label=label, category=category, owner_id=user.id)
    db.add(db_set)
    db.flush()  # assign db_set.id for building image object keys

    for position, raw in enumerate(raw_cards):
        if not isinstance(raw, dict):
            raise HTTPException(status_code=400, detail=f"Card at index {position} is not an object")
        normalized = _normalize_card(raw)

        front_image_key, front_image_url = _store_image(normalized["frontImage"], db_set.id, position, "front", zf)
        back_image_key, back_image_url = _store_image(normalized["backImage"], db_set.id, position, "back", zf)

        db.add(
            CardModel(
                set_id=db_set.id,
                position=position,
                front=normalized["front"],
                back=normalized["back"],
                symbols=normalized["symbols"],
                matching=normalized["matching"],
                front_image_key=front_image_key,
                back_image_key=back_image_key,
                front_image_url=front_image_url,
                back_image_url=back_image_url,
            )
        )

    db.commit()
    db.refresh(db_set)
    return _set_detail(db_set)


@router.post("/sets/{set_id}/cards", response_model=SetDetail, status_code=201)
def add_cards(
    set_id: int, payload: CardsIn, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)
):
    """Dokłada karty na koniec istniejącego zestawu.

    Zestaw zachowuje id i slug, więc odnośniki i zapisany postęp rundy nie
    tracą ważności — inaczej niż przy skasowaniu i założeniu go od nowa.
    """
    s = db.get(SetModel, set_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Set not found")
    if s.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Nie jesteś właścicielem tego zestawu")
    if not payload.cards:
        raise HTTPException(status_code=400, detail="Expected a non-empty list of cards")

    # Pozycje liczymy od najwyższej istniejącej, a nie od liczby kart: gdyby
    # kiedyś doszło kasowanie pojedynczych kart, licznik zrobiłby duplikat.
    next_position = max((c.position for c in s.cards), default=-1) + 1

    for offset, raw in enumerate(payload.cards):
        if not isinstance(raw, dict):
            raise HTTPException(status_code=400, detail=f"Card at index {offset} is not an object")
        normalized = _normalize_card(raw)
        if not normalized["front"]:
            raise HTTPException(status_code=400, detail=f"Card at index {offset} has no front")

        position = next_position + offset
        front_image_key, front_image_url = _store_image(normalized["frontImage"], s.id, position, "front")
        back_image_key, back_image_url = _store_image(normalized["backImage"], s.id, position, "back")

        db.add(
            CardModel(
                set_id=s.id,
                position=position,
                front=normalized["front"],
                back=normalized["back"],
                symbols=normalized["symbols"],
                matching=normalized["matching"],
                front_image_key=front_image_key,
                back_image_key=back_image_key,
                front_image_url=front_image_url,
                back_image_url=back_image_url,
            )
        )

    db.commit()
    db.refresh(s)
    return _set_detail(s)


@router.delete("/sets/{set_id}", status_code=204)
def delete_set(set_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    s = db.get(SetModel, set_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Set not found")
    if s.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Nie jesteś właścicielem tego zestawu")
    db.delete(s)
    db.commit()
    storage.delete_set_images(set_id)


def _replace_image(card: CardModel, side: str, value: str | None) -> None:
    old_key = card.front_image_key if side == "front" else card.back_image_key
    key, url = _store_image(value, card.set_id, card.position, side)
    if old_key and old_key != key:
        storage.delete_object(old_key)
    if side == "front":
        card.front_image_key, card.front_image_url = key, url
    else:
        card.back_image_key, card.back_image_url = key, url


@router.patch("/cards/{card_id}", response_model=CardOut)
def update_card(
    card_id: int, payload: CardUpdate, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)
):
    card = db.get(CardModel, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    if card.set.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Nie jesteś właścicielem tego zestawu")

    data = payload.model_dump(exclude_unset=True)
    if data.get("front") is not None:
        card.front = data["front"]
    if data.get("back") is not None:
        card.back = data["back"]
    if "symbols" in data:
        card.symbols = data["symbols"]
    if "matching" in data:
        card.matching = data["matching"]
    if "frontImage" in data:
        _replace_image(card, "front", data["frontImage"])
    if "backImage" in data:
        _replace_image(card, "back", data["backImage"])

    db.commit()
    db.refresh(card)
    return _card_out(card)


def _set_detail(s: SetModel) -> SetDetail:
    return SetDetail(
        id=s.id,
        slug=s.slug,
        label=s.label,
        category=s.category,
        createdAt=s.created_at,
        cards=[_card_out(c) for c in s.cards],
    )


@router.delete("/cards/{card_id}", response_model=SetDetail)
def delete_card(card_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    """Kasuje jedną kartę i zwraca zestaw po zmianie.

    Pozostałe karty są przenumerowywane, żeby pozycje zostały ciągłe — bez
    tego licznik „Karta 3 / 5" liczyłby dziury. Obrazki karty znikają razem
    z nią; klucze obiektów pozostałych kart się nie zmieniają, bo trzyma je
    kolumna, a nie pozycja.
    """
    card = db.get(CardModel, card_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    s = card.set
    if s.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Nie jesteś właścicielem tego zestawu")
    if len(s.cards) == 1:
        raise HTTPException(
            status_code=400,
            detail="To ostatnia karta zestawu — skasuj cały zestaw zamiast niej",
        )

    for key in (card.front_image_key, card.back_image_key):
        if key:
            storage.delete_object(key)

    db.delete(card)
    db.flush()
    db.refresh(s)
    for position, remaining in enumerate(s.cards):
        remaining.position = position

    db.commit()
    db.refresh(s)
    return _set_detail(s)


@router.put("/sets/{set_id}/cards/order", response_model=SetDetail)
def reorder_cards(
    set_id: int, payload: CardOrderIn, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)
):
    """Ustawia kolejność kart według podanej listy identyfikatorów.

    Lista musi być pełną permutacją kart zestawu — częściowa kolejność
    zostawiłaby resztę na pozycjach, które już do kogoś należą.
    """
    s = db.get(SetModel, set_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Set not found")
    if s.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Nie jesteś właścicielem tego zestawu")

    wanted = payload.cardIds
    if len(set(wanted)) != len(wanted):
        raise HTTPException(status_code=400, detail="cardIds zawiera powtórzenia")
    if set(wanted) != {c.id for c in s.cards}:
        raise HTTPException(
            status_code=400,
            detail=f"cardIds musi zawierać dokładnie karty tego zestawu ({len(s.cards)} sztuk)",
        )

    by_id = {c.id: c for c in s.cards}
    for position, card_id in enumerate(wanted):
        by_id[card_id].position = position

    db.commit()
    db.refresh(s)
    return _set_detail(s)


@router.get("/images/{key:path}")
def get_image(key: str):
    try:
        response = storage.get_object(key)
    except S3Error as e:
        if e.code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="Image not found")
        raise HTTPException(status_code=502, detail="Storage error")

    def stream():
        try:
            yield from response.stream(32 * 1024)
        finally:
            response.close()
            response.release_conn()

    content_type = response.headers.get("content-type", "application/octet-stream")
    return StreamingResponse(stream(), media_type=content_type)
