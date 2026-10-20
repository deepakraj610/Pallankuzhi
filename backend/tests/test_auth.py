"""Tests for the auth module (uses the test Postgres on port 5433)."""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.services import auth_service

PASSWORD = "supersecret1"


@pytest.fixture()
def client() -> Iterator[TestClient]:
    auth_service.login_limiter.reset()
    with TestClient(app, follow_redirects=False) as c:
        yield c
    auth_service.login_limiter.reset()


def _email() -> str:
    return f"auth_{uuid.uuid4().hex[:10]}@example.com"


def _register(client: TestClient, email: str | None = None) -> str:
    email = email or _email()
    resp = client.post(
        "/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Tester"},
    )
    assert resp.status_code == 201, resp.text
    return email


def _login(client: TestClient, email: str, password: str = PASSWORD) -> dict[str, str]:
    resp = client.post("/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    body: dict[str, str] = resp.json()
    return body


def test_register_and_duplicate(client: TestClient) -> None:
    email = _email()
    resp = client.post(
        "/auth/register", json={"email": email, "password": PASSWORD, "full_name": "T"}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == email
    assert body["is_active"] is True and body["is_verified"] is False
    assert body["oauth_provider"] is None
    assert "hashed_password" not in body
    dup = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert dup.status_code == 409
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        assert user.hashed_password and user.hashed_password != PASSWORD


def test_register_short_password(client: TestClient) -> None:
    resp = client.post("/auth/register", json={"email": _email(), "password": "short"})
    assert resp.status_code == 422


def test_login_and_me(client: TestClient) -> None:
    email = _register(client)
    tokens = _login(client, email)
    assert tokens["token_type"] == "bearer"
    me = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_login_wrong_password(client: TestClient) -> None:
    email = _register(client)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "wrongpass1"}
    )
    assert resp.status_code == 401


def test_me_requires_valid_access_token(client: TestClient) -> None:
    assert client.get("/auth/me").status_code == 401
    assert (
        client.get("/auth/me", headers={"Authorization": "Bearer junk"}).status_code
        == 401
    )
    tokens = _login(client, _register(client))
    resp = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {tokens['refresh_token']}"}
    )
    assert resp.status_code == 401


def test_refresh_rotates_and_revokes_old(client: TestClient) -> None:
    tokens = _login(client, _register(client))
    resp = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 200
    new = resp.json()
    assert new["refresh_token"] != tokens["refresh_token"]
    reuse = client.post(
        "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert reuse.status_code == 401
    # reuse of a revoked token revokes the whole family, including the new token
    after = client.post("/auth/refresh", json={"refresh_token": new["refresh_token"]})
    assert after.status_code == 401
    with SessionLocal() as db:
        rows = db.scalars(select(RefreshToken)).all()
        assert all(r.token_hash != tokens["refresh_token"] for r in rows)


def test_refresh_rejects_garbage_and_access_token(client: TestClient) -> None:
    tokens = _login(client, _register(client))
    assert client.post("/auth/refresh", json={"refresh_token": "x"}).status_code == 401
    resp = client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert resp.status_code == 401


def test_logout_revokes(client: TestClient) -> None:
    tokens = _login(client, _register(client))
    resp = client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 204
    again = client.post(
        "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert again.status_code == 401


def test_login_rate_limit(client: TestClient) -> None:
    codes = [
        client.post(
            "/auth/login", data={"username": "nobody@example.com", "password": "x"}
        ).status_code
        for _ in range(11)
    ]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429


def test_google_unconfigured_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.routers.auth.google_configured", lambda: False)
    assert client.get("/auth/google").status_code == 503
    assert client.get("/auth/google/callback?code=x&state=y").status_code == 503


def test_google_flow(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routers.auth.google_configured", lambda: True)
    monkeypatch.setattr("app.auth.oauth.google_configured", lambda: True)
    start = client.get("/auth/google")
    assert start.status_code in (302, 307)
    location = start.headers["location"]
    assert location.startswith("https://accounts.google.com/")
    state = location.split("state=")[1].split("&")[0]
    email = _email()

    async def fake_exchange(code: str, redirect_uri: str) -> dict[str, str]:
        return {"email": email, "name": "G User", "verified_email": True}

    monkeypatch.setattr("app.routers.auth.exchange_code_for_user", fake_exchange)
    cb = client.get(f"/auth/google/callback?code=abc&state={state}")
    assert cb.status_code in (302, 307)
    loc = cb.headers["location"]
    assert "/login#access_token=" in loc and "&refresh_token=" in loc
    assert cb.headers["referrer-policy"] == "no-referrer"
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        assert user.oauth_provider == "google" and user.is_verified is True
    bad = client.get("/auth/google/callback?code=abc&state=bogus")
    assert bad.status_code == 400
