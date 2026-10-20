"""Password hashing and JWT helpers."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode(
        "utf-8"
    )


# Random-plaintext hash verified against when the account does not exist, so
# login timing does not reveal whether an email is registered.
DUMMY_HASH = hash_password(secrets.token_hex(16))


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


def hash_token(token: str) -> str:
    """Deterministic SHA-256 digest used to store refresh tokens at rest."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _encode(data: dict[str, Any], expires: timedelta, token_type: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        **data,
        "exp": now + expires,
        "iat": now,
        "jti": uuid.uuid4().hex,
        "type": token_type,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(data: dict[str, Any]) -> str:
    minutes = get_settings().ACCESS_TOKEN_EXPIRE_MINUTES
    return _encode(data, timedelta(minutes=minutes), "access")


def create_refresh_token(data: dict[str, Any]) -> str:
    days = get_settings().REFRESH_TOKEN_EXPIRE_DAYS
    return _encode(data, timedelta(days=days), "refresh")


def create_state_token(nonce: str) -> str:
    """Short-lived signed OAuth state token bound to a browser nonce."""
    return _encode(
        {"sub": "oauth", "nonce": nonce}, timedelta(minutes=10), "oauth_state"
    )


def decode_token(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["exp", "sub", "type"]},
        )
    except jwt.PyJWTError:
        return None
    return payload
