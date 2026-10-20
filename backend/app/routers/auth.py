"""Auth endpoints."""

import logging
import secrets
from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth.jwt import create_state_token, decode_token
from app.auth.oauth import (
    build_google_auth_url,
    exchange_code_for_user,
    google_configured,
)
from app.config import get_settings
from app.dependencies import get_current_user, get_db
from app.exceptions import AppException, BadRequestError
from app.models.user import User
from app.schemas.auth import RefreshRequest, RegisterRequest, Token, UserResponse
from app.services import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

DbDep = Annotated[Session, Depends(get_db)]


NONCE_COOKIE = "oauth_nonce"
NONCE_COOKIE_PATH = "/auth/google"


def _require_google() -> None:
    if not google_configured():
        raise AppException("Google login is not configured", "OAUTH_UNAVAILABLE", 503)


def _callback_uri(request: Request) -> str:
    configured = get_settings().OAUTH_REDIRECT_URI
    return configured or str(request.url_for("google_callback"))


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _limit(limiter: auth_service.RateLimiter, key: str) -> None:
    if not limiter.hit(key):
        raise AppException("Too many requests, try again later", "RATE_LIMITED", 429)


def _frontend_redirect(url: str) -> RedirectResponse:
    """Redirect that never leaks the URL (tokens live in the fragment)."""
    response = RedirectResponse(url)
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    response.delete_cookie(NONCE_COOKIE, path=NONCE_COOKIE_PATH)
    return response


@router.post("/register", response_model=UserResponse, status_code=201)
def register(req: RegisterRequest, request: Request, db: DbDep) -> User:
    _limit(auth_service.register_limiter, f"ip:{_client_ip(request)}")
    return auth_service.register_user(db, req)


@router.post("/login", response_model=Token)
def login(
    request: Request, form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DbDep
) -> Token:
    _limit(auth_service.login_limiter, f"ip:{_client_ip(request)}")
    _limit(auth_service.login_limiter, f"email:{form.username.strip().lower()}")
    user = auth_service.authenticate(db, form.username, form.password)
    return auth_service.issue_tokens(db, user)


@router.post("/refresh", response_model=Token)
def refresh(req: RefreshRequest, request: Request, db: DbDep) -> Token:
    _limit(auth_service.refresh_limiter, f"ip:{_client_ip(request)}")
    return auth_service.rotate_refresh_token(db, req.refresh_token)


@router.post("/logout", status_code=204)
def logout(req: RefreshRequest, db: DbDep) -> Response:
    auth_service.revoke_refresh_token(db, req.refresh_token)
    return Response(status_code=204)


@router.get("/me", response_model=UserResponse)
def me(user: Annotated[User, Depends(get_current_user)]) -> User:
    return user


@router.get("/google")
def google_login(request: Request) -> RedirectResponse:
    _require_google()
    nonce = secrets.token_urlsafe(32)
    url = build_google_auth_url(_callback_uri(request), create_state_token(nonce))
    response = RedirectResponse(url)
    response.set_cookie(
        NONCE_COOKIE,
        nonce,
        max_age=600,
        httponly=True,
        samesite="lax",
        secure=get_settings().FRONTEND_URL.lower().startswith("https://"),
        path=NONCE_COOKIE_PATH,
    )
    return response


@router.get("/google/callback", name="google_callback")
async def google_callback(
    request: Request, db: DbDep, code: str | None = None, state: str | None = None
) -> RedirectResponse:
    # async only because the Google exchange is awaited; DB work is offloaded.
    _require_google()
    _limit(auth_service.oauth_limiter, f"ip:{_client_ip(request)}")
    frontend = get_settings().FRONTEND_URL.rstrip("/")
    if not code:
        return _frontend_redirect(f"{frontend}/login?error=oauth_cancelled")
    payload = decode_token(state) if state else None
    cookie_nonce = request.cookies.get(NONCE_COOKIE, "")
    token_nonce = payload.get("nonce") if payload else None
    if (
        not payload
        or payload.get("type") != "oauth_state"
        or not isinstance(token_nonce, str)
        or not cookie_nonce
        or not secrets.compare_digest(cookie_nonce, token_nonce)
    ):
        raise BadRequestError("Invalid OAuth state", "INVALID_STATE")
    try:
        profile = await exchange_code_for_user(code, _callback_uri(request))
    except AppException:
        logger.warning("Google code exchange failed", exc_info=True)
        return _frontend_redirect(f"{frontend}/login?error=oauth_failed")
    email = profile.get("email")
    if not isinstance(email, str) or not email:
        raise BadRequestError("Google account has no email", "OAUTH_NO_EMAIL")
    verified = profile.get("verified_email", profile.get("email_verified"))
    if verified is not True:
        raise BadRequestError(
            "Google email address is not verified", "OAUTH_EMAIL_UNVERIFIED"
        )
    name = profile.get("name")
    user = await run_in_threadpool(
        auth_service.upsert_google_user,
        db,
        email,
        name if isinstance(name, str) else None,
    )
    tokens = await run_in_threadpool(auth_service.issue_tokens, db, user)
    fragment = urlencode(
        {"access_token": tokens.access_token, "refresh_token": tokens.refresh_token}
    )
    return _frontend_redirect(f"{frontend}/login#{fragment}")
