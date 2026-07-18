import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from . import security
from .config import settings
from .db import get_db
from .mailer import send_login_code_email
from .models import LoginCodeModel, SessionModel, SetModel, UserModel
from .schemas import AuthOut, RequestCodeIn, UserOut, VerifyCodeIn

router = APIRouter(prefix="/api/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _naive_utcnow() -> datetime:
    # All datetime columns here are plain (non-tz) DateTime — comparing a
    # tz-aware value against them would either raise in Python or get
    # silently reinterpreted through the DB session timezone in SQL, so
    # everything in this module deals in naive-but-actually-UTC datetimes.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_email(email: str) -> str:
    email = email.strip().lower()
    if len(email) > 254 or not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Nieprawidłowy adres email")
    return email


@router.post("/request-code", status_code=204)
def request_code(payload: RequestCodeIn, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)

    cooldown_cutoff = _naive_utcnow() - timedelta(seconds=settings.login_code_resend_cooldown_seconds)
    recent = db.scalar(
        select(LoginCodeModel)
        .where(LoginCodeModel.email == email, LoginCodeModel.created_at > cooldown_cutoff)
        .order_by(LoginCodeModel.created_at.desc())
    )
    if recent is not None:
        raise HTTPException(status_code=429, detail="Poczekaj chwilę przed ponownym wysłaniem kodu")

    code = security.generate_code()
    salt = security.generate_salt()
    db.add(
        LoginCodeModel(
            email=email,
            code_hash=security.hash_code(code, salt),
            salt=salt,
            expires_at=_naive_utcnow() + timedelta(minutes=settings.login_code_ttl_minutes),
        )
    )
    db.commit()

    send_login_code_email(email, code)


@router.post("/verify", response_model=AuthOut)
def verify_code(payload: VerifyCodeIn, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    code = payload.code.strip()

    login_code = db.scalar(
        select(LoginCodeModel)
        .where(LoginCodeModel.email == email, LoginCodeModel.consumed_at.is_(None))
        .order_by(LoginCodeModel.created_at.desc())
    )
    if login_code is None or login_code.expires_at < _naive_utcnow():
        raise HTTPException(status_code=400, detail="Kod wygasł lub jest nieprawidłowy. Wyślij nowy.")
    if login_code.attempts >= settings.login_code_max_attempts:
        raise HTTPException(status_code=400, detail="Za dużo prób. Wyślij nowy kod.")

    if security.hash_code(code, login_code.salt) != login_code.code_hash:
        login_code.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Nieprawidłowy kod")

    login_code.consumed_at = _naive_utcnow()

    user = db.scalar(select(UserModel).where(UserModel.email == email))
    if user is None:
        # The very first account this app has ever seen inherits every
        # pre-existing, owner-less set (created before auth existed).
        is_first_ever_user = db.scalar(select(UserModel.id).limit(1)) is None

        user = UserModel(email=email)
        db.add(user)
        db.flush()

        if is_first_ever_user:
            db.execute(update(SetModel).where(SetModel.owner_id.is_(None)).values(owner_id=user.id))

    token = security.generate_token()
    db.add(
        SessionModel(
            user_id=user.id,
            token_hash=security.hash_token(token),
            expires_at=_naive_utcnow() + timedelta(days=settings.session_ttl_days),
        )
    )
    db.commit()

    return AuthOut(token=token, user=UserOut(id=user.id, email=user.email))


def get_current_user(
    authorization: str | None = Header(default=None), db: Session = Depends(get_db)
) -> UserModel:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Brak autoryzacji")
    token = authorization.removeprefix("Bearer ").strip()

    session = db.scalar(select(SessionModel).where(SessionModel.token_hash == security.hash_token(token)))
    if session is None or session.expires_at < _naive_utcnow():
        raise HTTPException(status_code=401, detail="Sesja wygasła, zaloguj się ponownie")

    return session.user


@router.get("/me", response_model=UserOut)
def get_me(user: UserModel = Depends(get_current_user)):
    return UserOut(id=user.id, email=user.email)


@router.post("/logout", status_code=204)
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        db.execute(delete(SessionModel).where(SessionModel.token_hash == security.hash_token(token)))
        db.commit()
