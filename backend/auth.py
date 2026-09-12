import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from . import deviceflow, security
from .config import settings
from .db import get_db
from .mailer import send_login_code_email
from .models import DeviceAuthModel, LoginCodeModel, SessionModel, SetModel, UserModel
from .schemas import (
    AuthOut,
    DeviceInfoOut,
    DeviceStartIn,
    DeviceStartOut,
    DeviceStatusOut,
    RequestCodeIn,
    UserOut,
    VerifyCodeIn,
)

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

    token = _new_session(db, user)
    db.commit()

    return AuthOut(token=token, user=UserOut(id=user.id, email=user.email))


def _new_session(db: Session, user: UserModel) -> str:
    """Zakłada sesję i zwraca token. Zapis zatwierdza wywołujący."""
    token = security.generate_token()
    db.add(
        SessionModel(
            user_id=user.id,
            token_hash=security.hash_token(token),
            expires_at=_naive_utcnow() + timedelta(days=settings.session_ttl_days),
        )
    )
    return token


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


def _device_request(db: Session, user_code: str) -> DeviceAuthModel:
    kod = deviceflow.normalizuj_kod(user_code)
    row = db.scalar(select(DeviceAuthModel).where(DeviceAuthModel.user_code == kod)) if kod else None
    if row is None:
        raise HTTPException(status_code=404, detail="Nie ma takiego żądania logowania")
    return row


def _device_status(row: DeviceAuthModel) -> str:
    return deviceflow.status(row.approved_at, row.denied_at, row.expires_at, _naive_utcnow())


@router.post("/device", response_model=DeviceStartOut, status_code=201)
def start_device_auth(payload: DeviceStartIn, db: Session = Depends(get_db)):
    """Zakłada żądanie logowania narzędzia bez przeglądarki.

    Bez autoryzacji — samo żądanie niczego jeszcze nie daje. Dostęp powstaje
    dopiero wtedy, gdy zalogowany człowiek zatwierdzi je w przeglądarce.
    """
    db.execute(delete(DeviceAuthModel).where(DeviceAuthModel.expires_at < _naive_utcnow()))

    device_code = security.generate_token()
    for _ in range(5):
        user_code = deviceflow.generuj_kod_uzytkownika()
        if db.scalar(select(DeviceAuthModel.id).where(DeviceAuthModel.user_code == user_code)) is None:
            break
    else:
        raise HTTPException(status_code=503, detail="Nie udało się wygenerować kodu, spróbuj ponownie")

    nazwa = (payload.name or "").strip() or "Nieznane narzędzie"
    db.add(
        DeviceAuthModel(
            user_code=user_code,
            device_code_hash=security.hash_token(device_code),
            client_name=nazwa[:80],
            expires_at=_naive_utcnow() + timedelta(minutes=settings.device_auth_ttl_minutes),
        )
    )
    db.commit()

    return DeviceStartOut(
        deviceCode=device_code,
        userCode=user_code,
        verifyPath=f"/?autoryzacja={user_code}",
        expiresIn=settings.device_auth_ttl_minutes * 60,
        interval=3,
    )


@router.get("/device/{device_code}", response_model=DeviceStatusOut)
def poll_device_auth(device_code: str, db: Session = Depends(get_db)):
    """Odbiór wyniku przez narzędzie.

    Token powstaje dopiero tutaj i wychodzi dokładnie raz — żądanie znika
    razem z odpowiedzią. Nieznany kod to dla pytającego to samo co wygasły:
    nie ma po co odróżniać "nie ma takiego" od "już po terminie".
    """
    row = db.scalar(
        select(DeviceAuthModel).where(DeviceAuthModel.device_code_hash == security.hash_token(device_code))
    )
    if row is None:
        return DeviceStatusOut(status=deviceflow.EXPIRED)

    stan = _device_status(row)
    if stan != deviceflow.APPROVED:
        if stan in (deviceflow.DENIED, deviceflow.EXPIRED):
            db.delete(row)
            db.commit()
        return DeviceStatusOut(status=stan)

    user = row.approved_user
    token = _new_session(db, user)
    db.delete(row)
    db.commit()
    return DeviceStatusOut(status=stan, token=token, user=UserOut(id=user.id, email=user.email))


@router.get("/device/kod/{user_code}", response_model=DeviceInfoOut)
def device_auth_info(
    user_code: str, user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Co właściwie zatwierdzamy — dla ekranu z przyciskiem."""
    row = _device_request(db, user_code)
    return DeviceInfoOut(
        userCode=row.user_code,
        clientName=row.client_name,
        status=_device_status(row),
        createdAt=row.created_at,
    )


@router.post("/device/kod/{user_code}/approve", status_code=204)
def approve_device_auth(
    user_code: str, user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
):
    row = _device_request(db, user_code)
    stan = _device_status(row)
    if stan != deviceflow.PENDING:
        raise HTTPException(status_code=400, detail=f"Żądanie nie czeka na decyzję (stan: {stan})")

    row.approved_user_id = user.id
    row.approved_at = _naive_utcnow()
    db.commit()


@router.post("/device/kod/{user_code}/deny", status_code=204)
def deny_device_auth(
    user_code: str, user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)
):
    row = _device_request(db, user_code)
    if _device_status(row) != deviceflow.PENDING:
        return
    row.denied_at = _naive_utcnow()
    db.commit()
