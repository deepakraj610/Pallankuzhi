"""Tests for the /api/games endpoints."""

from collections.abc import Generator
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.dependencies import get_current_user
from app.main import app
from app.models import Game, Move, User


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    session = SessionLocal()
    yield session
    session.close()


@pytest.fixture()
def users(db: Session) -> Generator[tuple[User, User], None, None]:
    a = User(email="games_a@example.com")
    b = User(email="games_b@example.com")
    db.add_all([a, b])
    db.commit()
    yield a, b
    db.query(User).filter(User.id.in_([a.id, b.id])).delete(synchronize_session=False)
    db.commit()


@pytest.fixture(autouse=True)
def _clear_overrides() -> Generator[None, None, None]:
    yield
    app.dependency_overrides.clear()


def _client(user: User) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user.id)
    return TestClient(app)


def _create(client: TestClient, difficulty: str = "easy") -> dict[str, Any]:
    resp = client.post("/api/games", json={"difficulty": difficulty})
    assert resp.status_code == 201, resp.text
    data: dict[str, Any] = resp.json()
    return data


def test_create_game(users: tuple[User, User]) -> None:
    client = _client(users[0])
    game = _create(client, "medium")
    assert game["board"] == [5] * 14
    assert game["current_player"] == "human"
    assert game["status"] == "in_progress"
    assert game["moves"] == []
    assert game["user_id"] == users[0].id
    assert client.post("/api/games", json={"difficulty": "hard"}).status_code == 422


def test_move_flow_and_invariants(users: tuple[User, User]) -> None:
    client = _client(users[0])
    game = _create(client)
    resp = client.post(f"/api/games/{game['id']}/moves", json={"cup_index": 2})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    g = body["game"]
    assert body["human_move"]["player"] == "human"
    assert body["human_move"]["move_number"] == 1
    if g["status"] == "in_progress":
        assert body["ai_move"]["player"] == "ai"
        assert body["ai_move"]["move_number"] == 2
        assert len(g["moves"]) == 2
        assert sum(g["board"]) + g["human_score"] + g["ai_score"] == 70
    detail = client.get(f"/api/games/{game['id']}").json()
    assert len(detail["moves"]) == len(g["moves"])


def test_invalid_moves(users: tuple[User, User]) -> None:
    client = _client(users[0])
    game = _create(client)
    url = f"/api/games/{game['id']}/moves"
    assert client.post(url, json={"cup_index": 9}).status_code == 400
    assert client.post(url, json={"cup_index": 99}).status_code == 400
    assert client.post(url, json={"cup_index": -1}).status_code == 400


def test_empty_cup_rejected(users: tuple[User, User], db: Session) -> None:
    client = _client(users[0])
    game = _create(client)
    row = db.get(Game, game["id"])
    assert row is not None
    row.board = [0, 5, 5, 5, 5, 5, 5] + [5] * 7
    row.human_score = 5
    db.commit()
    resp = client.post(f"/api/games/{game['id']}/moves", json={"cup_index": 0})
    assert resp.status_code == 400
    assert resp.json()["code"] == "INVALID_MOVE"


def test_ownership_404(users: tuple[User, User]) -> None:
    game = _create(_client(users[0]))
    other = _client(users[1])
    assert other.get(f"/api/games/{game['id']}").status_code == 404
    assert (
        other.post(f"/api/games/{game['id']}/moves", json={"cup_index": 0}).status_code
        == 404
    )
    assert other.delete(f"/api/games/{game['id']}").status_code == 404


def test_abandon(users: tuple[User, User]) -> None:
    client = _client(users[0])
    game = _create(client)
    assert client.delete(f"/api/games/{game['id']}").status_code == 204
    detail = client.get(f"/api/games/{game['id']}").json()
    assert detail["status"] == "abandoned"
    assert detail["finished_at"] is not None
    assert client.delete(f"/api/games/{game['id']}").status_code == 409
    resp = client.post(f"/api/games/{game['id']}/moves", json={"cup_index": 0})
    assert resp.status_code == 409


def test_list_pagination_and_filter(users: tuple[User, User]) -> None:
    client = _client(users[0])
    ids = [_create(client)["id"] for _ in range(3)]
    client.delete(f"/api/games/{ids[0]}")
    data = client.get("/api/games?page=1&page_size=2").json()
    assert data["total"] == 3
    assert data["page_size"] == 2
    assert [i["id"] for i in data["items"]] == [ids[2], ids[1]]
    assert "moves" not in data["items"][0]
    ab = client.get("/api/games?status=abandoned").json()
    assert ab["total"] == 1 and ab["items"][0]["id"] == ids[0]
    assert _client(users[1]).get("/api/games").json()["total"] == 0


def test_full_game_finishes(users: tuple[User, User]) -> None:
    client = _client(users[0])
    game = _create(client)
    gid = game["id"]
    state = game
    for _ in range(400):
        if state["status"] != "in_progress":
            break
        cup = next(i for i in range(7) if state["board"][i] > 0)
        resp = client.post(f"/api/games/{gid}/moves", json={"cup_index": cup})
        assert resp.status_code == 200, resp.text
        state = resp.json()["game"]
    assert state["status"] in {"human_won", "ai_won", "draw"}
    assert state["finished_at"] is not None
    assert sum(state["board"]) == 0
    assert state["human_score"] + state["ai_score"] == 70
    resp = client.post(f"/api/games/{gid}/moves", json={"cup_index": 0})
    assert resp.status_code == 409


def test_game_over_when_ai_has_no_seeds(users: tuple[User, User], db: Session) -> None:
    client = _client(users[0])
    game = _create(client)
    row = db.get(Game, game["id"])
    assert row is not None
    row.board = [1, 0, 0, 0, 0, 0, 0] + [0] * 7
    row.human_score = 69
    db.commit()
    resp = client.post(f"/api/games/{game['id']}/moves", json={"cup_index": 0})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ai_move"] is None
    assert body["game"]["status"] == "human_won"
    assert body["game"]["human_score"] == 70


def test_move_response_includes_sowing_traces(users: tuple[User, User]) -> None:
    client = _client(users[0])
    game = _create(client)
    resp = client.post(f"/api/games/{game['id']}/moves", json={"cup_index": 0})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    human_trace = data["human_trace"]
    assert human_trace[0] == {"kind": "pickup", "cup": 0, "count": 5}
    assert [s["cup"] for s in human_trace[1:6]] == [1, 2, 3, 4, 5]
    assert all(s["kind"] in {"pickup", "drop", "capture"} for s in human_trace)
    captured = sum(s["count"] for s in human_trace if s["kind"] == "capture")
    assert captured == data["human_move"]["seeds_captured"]

    assert data["ai_move"] is not None
    ai_captured = sum(s["count"] for s in data["ai_trace"] if s["kind"] == "capture")
    assert ai_captured == data["ai_move"]["seeds_captured"]
    assert data["ai_trace"][0]["kind"] == "pickup"


def test_final_move_returns_sweep_that_explains_final_scores(
    users: tuple[User, User],
) -> None:
    client = _client(users[0])
    state = _create(client)
    gid = state["id"]
    captured = {"human": 0, "ai": 0}
    last: dict[str, Any] = {}
    for _ in range(400):
        if state["status"] != "in_progress":
            break
        cup = next(i for i in range(7) if state["board"][i] > 0)
        last = client.post(f"/api/games/{gid}/moves", json={"cup_index": cup}).json()
        state = last["game"]
        # Mid-game responses carry no sweep.
        if state["status"] == "in_progress":
            assert last["sweep"] == []
        captured["human"] += last["human_move"]["seeds_captured"]
        if last["ai_move"]:
            captured["ai"] += last["ai_move"]["seeds_captured"]

    assert state["status"] != "in_progress"
    swept = {"human": 0, "ai": 0}
    for step in last["sweep"]:
        assert (step["cup"] < 7) == (step["owner"] == "human")
        swept[step["owner"]] += step["count"]
    assert state["human_score"] == captured["human"] + swept["human"]
    assert state["ai_score"] == captured["ai"] + swept["ai"]


def test_stalemate_ends_a_game_where_nobody_can_capture(
    users: tuple[User, User], db: Session
) -> None:
    client = _client(users[0])
    game = _create(client)
    row = db.get(Game, game["id"])
    assert row is not None
    # One seed each, 34 captured each, and the last 40 moves captured nothing.
    row.board = [1] + [0] * 7 + [1] + [0] * 5
    row.human_score = 34
    row.ai_score = 34
    for n in range(1, 41):
        db.add(
            Move(
                game_id=row.id,
                move_number=n,
                player="human" if n % 2 else "ai",
                cup_index=0 if n % 2 else 7,
                seeds_sown=1,
                seeds_captured=0,
                board_after=[0] * 14,
            )
        )
    db.commit()

    resp = client.post(f"/api/games/{game['id']}/moves", json={"cup_index": 0})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["game"]["status"] == "draw"
    assert body["game"]["board"] == [0] * 14
    assert body["game"]["human_score"] == 35
    assert body["game"]["ai_score"] == 35
    assert sorted(s["owner"] for s in body["sweep"]) == ["ai", "human"]


def test_a_recent_capture_prevents_stalemate(
    users: tuple[User, User], db: Session
) -> None:
    client = _client(users[0])
    game = _create(client)
    row = db.get(Game, game["id"])
    assert row is not None
    row.board = [1] + [0] * 7 + [1] + [0] * 5
    row.human_score = 34
    row.ai_score = 34
    for n in range(1, 41):
        db.add(
            Move(
                game_id=row.id,
                move_number=n,
                player="human" if n % 2 else "ai",
                cup_index=0,
                seeds_sown=1,
                seeds_captured=1 if n == 30 else 0,
                board_after=[0] * 14,
            )
        )
    db.commit()

    resp = client.post(f"/api/games/{game['id']}/moves", json={"cup_index": 0})
    assert resp.status_code == 200, resp.text
    assert resp.json()["game"]["status"] == "in_progress"
