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
