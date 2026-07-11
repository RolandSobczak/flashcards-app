import json
import re

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from minio.error import S3Error
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import storage
from .db import get_db
from .models import CardModel, SetModel
from .schemas import CardOut, SetDetail, SetSummary

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


def _store_image(value: str | None, set_id: int, position: int, side: str) -> tuple[str | None, str | None]:
    """Returns (object_key, external_url) — embedded image data is decoded
    and pushed to MinIO (object_key set); anything else that isn't empty
    (an http URL, a local /public path, ...) is kept as-is (external_url set)
    so it isn't silently dropped."""
    decoded = storage.decode_image(value)
    if decoded:
        key = storage.object_key(set_id, position, side, decoded.content_type)
        storage.upload_image(key, decoded)
        return key, None
    return None, (value or None)


@router.get("/sets", response_model=list[SetSummary])
def list_sets(db: Session = Depends(get_db)):
    sets = db.scalars(select(SetModel).order_by(SetModel.created_at.desc())).all()
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
def get_set(set_id: int, db: Session = Depends(get_db)):
    s = db.get(SetModel, set_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Set not found")
    return SetDetail(
        id=s.id,
        slug=s.slug,
        label=s.label,
        category=s.category,
        createdAt=s.created_at,
        cards=[_card_out(c) for c in s.cards],
    )


@router.post("/sets", response_model=SetDetail, status_code=201)
async def create_set(
    file: UploadFile,
    label: str = Form(...),
    category: str | None = Form(None),
    db: Session = Depends(get_db),
):
    raw_bytes = await file.read()
    try:
        raw_cards = json.loads(raw_bytes)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    if not isinstance(raw_cards, list) or not raw_cards:
        raise HTTPException(status_code=400, detail="Expected a non-empty JSON array of cards")

    label = label.strip() or file.filename or "Zestaw"
    slug = _unique_slug(db, label)

    db_set = SetModel(slug=slug, label=label, category=category)
    db.add(db_set)
    db.flush()  # assign db_set.id for building image object keys

    for position, raw in enumerate(raw_cards):
        if not isinstance(raw, dict):
            raise HTTPException(status_code=400, detail=f"Card at index {position} is not an object")
        normalized = _normalize_card(raw)

        front_image_key, front_image_url = _store_image(normalized["frontImage"], db_set.id, position, "front")
        back_image_key, back_image_url = _store_image(normalized["backImage"], db_set.id, position, "back")

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
    return SetDetail(
        id=db_set.id,
        slug=db_set.slug,
        label=db_set.label,
        category=db_set.category,
        createdAt=db_set.created_at,
        cards=[_card_out(c) for c in db_set.cards],
    )


@router.delete("/sets/{set_id}", status_code=204)
def delete_set(set_id: int, db: Session = Depends(get_db)):
    s = db.get(SetModel, set_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Set not found")
    db.delete(s)
    db.commit()
    storage.delete_set_images(set_id)


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
