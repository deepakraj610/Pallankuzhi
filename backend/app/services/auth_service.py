"""Business logic for authentication."""

import logging
import threading
import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.jwt import (
    DUMMY_HASH,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.config import get_settings
from app.exceptions import ConflictError, UnauthorizedError
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import RegisterRequest, Token

logger = logging.getLogger(__name__)


class RateLimiter:
    """In-memory sliding-window limiter keyed by an opaque string.

    Limitation: state lives in this process only. With several workers or
    replicas each keeps its own counters (the effective limit is multiplied) and
    counters reset on restart. Use a shared store (e.g. Redis) if strict global
    limits are required. Stale keys are evicted periodically so memory stays
    bounded by the number of keys active within one window.
    """

    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._hits: dict[str, list[float]] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def _sweep(self, now: float) -> None:
        if now - self._last_sweep < self.window:
            return
        self._last_sweep = now
        for key in [
            k for k, v in self._hits.items() if not v or now - v[-1] >= self.window
        ]:
            del self._hits[key]

    def hit(self, key: str) -> bool:
        """Record an attempt; return False if the limit is exceeded."""
        now = time.monotonic()
        with self._lock:
            self._sweep(now)
            recent = [t for t in self._hits.get(key, []) if now - t < self.window]
            if len(recent) >= self.max_attempts:
                self._hits[key] = recent
                return False
            recent.append(now)
            self._hits[key] = recent
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


# Login is keyed on both client IP ("ip:...") and email ("email:...").
login_limiter = RateLimiter(max_attempts=10, window_seconds=60)
register_limiter = RateLimiter(max_attempts=20, window_seconds=60)
refresh_limiter = RateLimiter(max_attempts=30, window_seconds=60)
oauth_limiter = RateLimiter(max_attempts=30, window_seconds=60)
ALL_LIMITERS = (login_limiter, register_limiter, refresh_limiter, oauth_limiter)


def reset_limiters() -> None:
    for limiter in ALL_LIMITERS:
        limiter.reset()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower()))


def register_user(db: Session, data: RegisterRequest) -> User:
    if get_user_by_email(db, data.email):
        raise ConflictError("Email already registered")
    user = User(
        email=data.email.lower(),
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError("Email already registered") from exc
    db.refresh(user)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    # Always run one bcrypt verification so timing does not leak existence.
    hashed = user.hashed_password if user and user.hashed_password else DUMMY_HASH
    password_ok = verify_password(password, hashed)
    if user is None or not user.hashed_password or not password_ok:
        raise UnauthorizedError("Incorrect email or password")
    if not user.is_active:
        raise UnauthorizedError("Account is inactive")
    return user


def issue_tokens(db: Session, user: User) -> Token:
    refresh = create_refresh_token({"sub": str(user.id)})
    expires = datetime.now(UTC) + timedelta(
        days=get_settings().REFRESH_TOKEN_EXPIRE_DAYS
    )
    db.add(
        RefreshToken(
            user_id=user.id, token_hash=hash_token(refresh), expires_at=expires
        )
    )
    db.commit()
    access = create_access_token({"sub": str(user.id)})
    return Token(access_token=access, refresh_token=refresh)


def _revoke_all_for_user(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )


def rotate_refresh_token(db: Session, token: str) -> Token:
    """Rotate a refresh token atomically (row lock) with reuse detection."""
    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise UnauthorizedError("Invalid refresh token")
    row = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(token))
        .with_for_update()
    )
    if row is None:
        raise UnauthorizedError("Invalid refresh token")
    if row.revoked:
        # A revoked token is being replayed: assume theft, kill every session.
        logger.warning("Refresh token reuse detected for user %s", row.user_id)
        _revoke_all_for_user(db, row.user_id)
        db.commit()
        raise UnauthorizedError("Invalid refresh token")
    if row.expires_at <= datetime.now(UTC):
        db.rollback()
        raise UnauthorizedError("Invalid refresh token")
    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        db.rollback()
        raise UnauthorizedError("Invalid refresh token")
    row.revoked = True
    db.flush()
    return issue_tokens(db, user)  # commits revocation + new token together


def revoke_refresh_token(db: Session, token: str) -> None:
    row = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(token))
    )
    if row is not None and not row.revoked:
        row.revoked = True
        db.commit()


def upsert_google_user(db: Session, email: str, full_name: str | None) -> User:
    """Create or link a Google-verified account.

    Callers must have checked that Google reports the email as verified.
    Linking to an existing local account removes its password and revokes its
    sessions, so a pre-registered (squatted) account cannot be kept by whoever
    created it.
    """
    user = get_user_by_email(db, email)
    if user is None:
        user = User(
            email=email.lower(),
            full_name=full_name,
            oauth_provider="google",
            is_verified=True,
        )
        db.add(user)
    else:
        if user.oauth_provider is None:
            user.oauth_provider = "google"
            user.hashed_password = None
            _revoke_all_for_user(db, user.id)
        user.is_verified = True
        if not user.full_name and full_name:
            user.full_name = full_name
    db.commit()
    db.refresh(user)
    return user
