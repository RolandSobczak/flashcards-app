from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserModel(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(Text, index=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    sets: Mapped[list["SetModel"]] = relationship(back_populates="owner")


class LoginCodeModel(Base):
    __tablename__ = "login_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(Text, index=True)
    code_hash: Mapped[str] = mapped_column(Text)
    salt: Mapped[str] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(default=0)
    consumed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    expires_at: Mapped[datetime]
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class SessionModel(Base):
    __tablename__ = "sessions"
    __table_args__ = (UniqueConstraint("token_hash", name="uq_sessions_token_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(Text, index=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    expires_at: Mapped[datetime]

    user: Mapped["UserModel"] = relationship()


class SetModel(Base):
    __tablename__ = "sets"
    __table_args__ = (UniqueConstraint("slug", name="uq_sets_slug"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(Text, index=True)
    label: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    # Nullable so pre-existing sets created before auth was added keep working;
    # the first user to ever log in claims all of them (see auth.py).
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    owner: Mapped["UserModel | None"] = relationship(back_populates="sets")
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
    # External image reference (URL or local /public path) for images that
    # weren't embedded data and so couldn't be extracted into MinIO.
    front_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    back_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    set: Mapped["SetModel"] = relationship(back_populates="cards")
