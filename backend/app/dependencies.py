"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth.jwt import decode_token
from app.database import get_db
from app.exceptions import UnauthorizedError
from app.models.user import User

__all__ = ["get_current_user", "get_db"]  # sync: runs in the threadpool

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Resolve the bearer access token to an active user, else 401."""
    payload = decode_token(token) if token else None
    if not payload or payload.get("type") != "access":
        raise UnauthorizedError("Invalid or missing token")
    try:
        user_id = int(str(payload.get("sub")))
    except ValueError as exc:
        raise UnauthorizedError("Invalid token") from exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or inactive")
    return user
