from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SetModel(Base):
    __tablename__ = "sets"
    __table_args__ = (UniqueConstraint("slug", name="uq_sets_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(Text, index=True)
    label: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    cards: Mapped[list["CardModel"]] = relationship(
        back_populates="set",
        cascade="all, delete-orphan",
        order_by="CardModel.position",
    )


class CardModel(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    set_id: Mapped[int] = mapped_column(ForeignKey("sets.id", ondelete="CASCADE"), index=True)
    position: Mapped[int]
    front: Mapped[str] = mapped_column(Text)
    back: Mapped[str] = mapped_column(Text)
    symbols: Mapped[str | None] = mapped_column(Text, nullable=True)
    matching: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    front_image_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    back_image_key: Mapped[str | None] = mapped_column(Text, nullable=True)

    set: Mapped["SetModel"] = relationship(back_populates="cards")
