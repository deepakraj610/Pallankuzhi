"""Google OAuth 2.0 helpers (authorization code flow)."""

from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.exceptions import AppException

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def google_configured() -> bool:
    return bool(get_settings().GOOGLE_CLIENT_ID)


def build_google_auth_url(redirect_uri: str, state: str) -> str:
    params = {
        "client_id": get_settings().GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_user(code: str, redirect_uri: str) -> dict[str, Any]:
    """Exchange an auth code for the Google profile of the signed-in user."""
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                },
            )
            token_resp.raise_for_status()
            access_token = token_resp.json().get("access_token")
            if not access_token:
                raise AppException("Google did not return a token", "OAUTH_FAILED", 502)
            info_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            info_resp.raise_for_status()
            profile: dict[str, Any] = info_resp.json()
    except httpx.HTTPError as exc:
        raise AppException("Google authentication failed", "OAUTH_FAILED", 502) from exc
    return profile
