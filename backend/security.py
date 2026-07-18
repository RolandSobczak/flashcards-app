import hashlib
import secrets


def generate_code() -> str:
    """A 6-digit numeric login code, e.g. '042817'."""
    return "".join(secrets.choice("0123456789") for _ in range(6))


def hash_code(code: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{code}".encode()).hexdigest()


def generate_salt() -> str:
    return secrets.token_hex(16)


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Session tokens are high-entropy already, so a plain hash (no salt) is
    enough — this just keeps the raw bearer token out of the database."""
    return hashlib.sha256(token.encode()).hexdigest()
