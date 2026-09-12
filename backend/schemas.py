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


class CardsIn(BaseModel):
    cards: list[dict]


class CardOrderIn(BaseModel):
    cardIds: list[int]


class RequestCodeIn(BaseModel):
    email: str


class VerifyCodeIn(BaseModel):
    email: str
    code: str


class UserOut(BaseModel):
    id: int
    email: str


class DeviceStartIn(BaseModel):
    name: str | None = None


class DeviceStartOut(BaseModel):
    deviceCode: str
    userCode: str
    verifyPath: str
    expiresIn: int
    interval: int


class DeviceStatusOut(BaseModel):
    status: str
    token: str | None = None
    user: UserOut | None = None


class DeviceInfoOut(BaseModel):
    userCode: str
    clientName: str
    status: str
    createdAt: datetime


class AuthOut(BaseModel):
    token: str
    user: UserOut


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
