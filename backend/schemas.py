from datetime import datetime

from pydantic import BaseModel


class CardOut(BaseModel):
    id: int
    position: int
    front: str
    back: str
    symbols: str | None
    matching: dict | None
    frontImage: str | None
    backImage: str | None


class CardUpdate(BaseModel):
    front: str | None = None
    back: str | None = None
    symbols: str | None = None
    matching: dict | None = None
    frontImage: str | None = None
    backImage: str | None = None


class SetSummary(BaseModel):
    id: int
    slug: str
    label: str
    category: str | None
    cardCount: int
    createdAt: datetime


class SetDetail(BaseModel):
    id: int
    slug: str
    label: str
    category: str | None
    createdAt: datetime
    cards: list[CardOut]
