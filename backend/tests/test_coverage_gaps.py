"""API-level tests covering error paths in auth_service, game_service and friends."""

import uuid
from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.dependencies import get_current_user
from app.exceptions import ConflictError
from app.main import app
from app.models import Game, User
from app.services import auth_service, game_service

PASSWORD = "supersecret1"


@pytest.fixture()
def client() -> Iterator[TestClient]:
    auth_service.login_limiter.reset()
    with TestClient(app, follow_redirects=False) as c:
        yield c
    app.dependency_overrides.clear()
    auth_service.login_limiter.reset()


def _email() -> str:
    return f"gap_{uuid.uuid4().hex[:10]}@example.com"


def _register(client: TestClient) -> str:
    email = _email()
    resp = client.post(
        "/auth/register", json={"email": email, "password": PASSWORD, "full_name": "G"}
    )
    assert resp.status_code == 201, resp.text
    return email


def _deactivate(email: str) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        user.is_active = False
        db.commit()


def test_register_race_integrity_error_is_conflict(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    email = _register(client)
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda db, e: None)
    resp = client.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert resp.status_code == 409


def test_login_inactive_account_rejected(client: TestClient) -> None:
    email = _register(client)
    _deactivate(email)
    resp = client.post("/auth/login", data={"username": email, "password": PASSWORD})
    assert resp.status_code == 401
    assert "inactive" in resp.json()["detail"].lower()


def test_refresh_for_inactive_user_rejected(client: TestClient) -> None:
    email = _register(client)
    tokens = client.post(
        "/auth/login", data={"username": email, "password": PASSWORD}
    ).json()
    _deactivate(email)
    resp = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 401


def test_me_for_inactive_user_rejected(client: TestClient) -> None:
    email = _register(client)
    tokens = client.post(
        "/auth/login", data={"username": email, "password": PASSWORD}
    ).json()
    _deactivate(email)
    resp = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert resp.status_code == 401


def test_logout_unknown_token_is_noop(client: TestClient) -> None:
    resp = client.post("/auth/logout", json={"refresh_token": "never-issued"})
    assert resp.status_code == 204


def test_upsert_google_user_links_existing_accounts() -> None:
    with SessionLocal() as db:
        # existing local-password account: password dropped, linked to google
        local = User(email=_email(), hashed_password="x", full_name=None)
        # existing account with neither password nor provider: becomes google
        bare = User(email=_email(), full_name=None)
        db.add_all([local, bare])
        db.commit()
        updated_local = auth_service.upsert_google_user(db, local.email, "Local Name")
        assert updated_local.is_verified is True
        assert updated_local.oauth_provider == "google"
        assert updated_local.hashed_password is None
        assert updated_local.full_name == "Local Name"
        updated_bare = auth_service.upsert_google_user(db, bare.email, None)
        assert updated_bare.oauth_provider == "google"
        assert updated_bare.is_verified is True
        # does not overwrite an existing name
        again = auth_service.upsert_google_user(db, local.email, "Other")
        assert again.full_name == "Local Name"


def test_google_callback_cancelled_and_missing_email(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.routers.auth.google_configured", lambda: True)
    monkeypatch.setattr("app.auth.oauth.google_configured", lambda: True)
    cancelled = client.get("/auth/google/callback?error=access_denied")
    assert cancelled.status_code in (302, 307)
    assert "error=oauth_cancelled" in cancelled.headers["location"]

    start = client.get("/auth/google")
    state = start.headers["location"].split("state=")[1].split("&")[0]

    async def no_email(code: str, redirect_uri: str) -> dict[str, str]:
        return {"name": "No Email"}

    monkeypatch.setattr("app.routers.auth.exchange_code_for_user", no_email)
    resp = client.get(f"/auth/google/callback?code=abc&state={state}")
    assert resp.status_code == 400
    assert resp.json()["code"] == "OAUTH_NO_EMAIL"


def test_unhandled_exception_returns_500_envelope(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def boom(db: Any, data: Any) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(auth_service, "register_user", boom)
    with TestClient(app, raise_server_exceptions=False) as c:
        resp = c.post("/auth/register", json={"email": _email(), "password": PASSWORD})
    assert resp.status_code == 500
    assert resp.json()["code"] == "INTERNAL_ERROR"


@pytest.fixture()
def owner() -> Iterator[User]:
    with SessionLocal() as db:
        user = User(email=_email())
        db.add(user)
        db.commit()
        db.refresh(user)
    yield user
    with SessionLocal() as db:
        db.query(User).filter(User.id == user.id).delete(synchronize_session=False)
        db.commit()


def _as(user: User) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user.id)
    return TestClient(app, raise_server_exceptions=False)


def test_unknown_game_is_404(owner: User, client: TestClient) -> None:
    c = _as(owner)
    assert c.get("/api/games/99999999").status_code == 404
    assert c.delete("/api/games/99999999").status_code == 404
    resp = c.post("/api/games/99999999/moves", json={"cup_index": 0})
    assert resp.status_code == 404


def test_move_engine_value_error_becomes_400(
    owner: User, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    c = _as(owner)
    gid = c.post("/api/games", json={"difficulty": "easy"}).json()["id"]

    def bad(*args: Any, **kwargs: Any) -> None:
        raise ValueError("engine says no")

    monkeypatch.setattr(game_service.engine, "apply_move", bad)
    resp = c.post(f"/api/games/{gid}/moves", json={"cup_index": 0})
    assert resp.status_code == 400
    assert resp.json()["code"] == "INVALID_MOVE"
    with SessionLocal() as db:
        game = db.get(Game, gid)
        assert game is not None and game.board == [5] * 14


def test_move_unexpected_error_rolls_back_and_500(
    owner: User, client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    c = _as(owner)
    gid = c.post("/api/games", json={"difficulty": "easy"}).json()["id"]

    def bad(*args: Any, **kwargs: Any) -> int:
        raise RuntimeError("ai exploded")

    monkeypatch.setattr(game_service, "choose_move", bad)
    resp = c.post(f"/api/games/{gid}/moves", json={"cup_index": 0})
    assert resp.status_code == 500
    detail = c.get(f"/api/games/{gid}").json()
    assert detail["board"] == [5] * 14
    assert detail["moves"] == []


def test_abandon_finished_game_conflicts(owner: User, client: TestClient) -> None:
    c = _as(owner)
    gid = c.post("/api/games", json={"difficulty": "easy"}).json()["id"]
    with SessionLocal() as db:
        game = db.get(Game, gid)
        assert game is not None
        game.status = "human_won"
        db.commit()
    assert c.delete(f"/api/games/{gid}").status_code == 409


def test_abandon_service_raises_conflict(owner: User) -> None:
    with SessionLocal() as db:
        game = game_service.create_game(db, owner.id, "easy")
        game_service.abandon_game(db, owner.id, game.id)
        with pytest.raises(ConflictError):
            game_service.abandon_game(db, owner.id, game.id)


def test_list_games_rejects_bad_params(owner: User, client: TestClient) -> None:
    c = _as(owner)
    assert c.get("/api/games?page=0").status_code == 422
    assert c.get("/api/games?page_size=1000").status_code == 422
    assert c.get("/api/games?status=bogus").status_code == 422
