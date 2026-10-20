"""Tests for GET /api/stats."""

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
    a = User(email="stats_a@example.com")
    b = User(email="stats_b@example.com")
    db.add_all([a, b])
    db.commit()
    yield a, b
    db.query(User).filter(User.id.in_([a.id, b.id])).delete(synchronize_session=False)
    db.commit()


def _client(user: User) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user.id)
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clear_overrides() -> Generator[None, None, None]:
    yield
    app.dependency_overrides.clear()


def _add(db: Session, user: User, difficulty: str, status: str, score: int = 0) -> None:
    """Add a game; `score` is the seeds the human captured via moves."""
    game = Game(
        user_id=user.id,
        difficulty=difficulty,
        board=[0] * 14,
        status=status,
        human_score=score + 7,  # includes a swept amount that must be ignored
    )
    db.add(game)
    db.flush()
    db.add(
        Move(
            game_id=game.id,
            move_number=1,
            player="human",
            cup_index=0,
            seeds_captured=score,
            board_after=[0] * 14,
        )
    )
    db.add(
        Move(
            game_id=game.id,
            move_number=2,
            player="ai",
            cup_index=7,
            seeds_captured=100,  # AI captures never count
            board_after=[0] * 14,
        )
    )
    db.commit()


def test_empty(users: tuple[User, User]) -> None:
    body: dict[str, Any] = _client(users[0]).get("/api/stats").json()
    assert body["total_games"] == 0
    assert body["avg_captured"] == 0
    assert body["current_streak"] == 0
    assert body["by_difficulty"] == {
        "easy": {"wins": 0, "losses": 0, "draws": 0},
        "medium": {"wins": 0, "losses": 0, "draws": 0},
    }


def test_aggregation_and_streak(db: Session, users: tuple[User, User]) -> None:
    a, b = users
    _add(db, a, "easy", "human_won", 40)
    _add(db, a, "easy", "ai_won", 20)
    _add(db, a, "medium", "draw", 30)
    _add(db, a, "medium", "human_won", 50)
    _add(db, a, "easy", "human_won", 60)
    _add(db, a, "easy", "in_progress", 99)
    _add(db, a, "medium", "abandoned", 99)
    _add(db, b, "easy", "ai_won", 10)

    body = _client(a).get("/api/stats").json()
    assert body["total_games"] == 5
    assert (body["wins"], body["losses"], body["draws"]) == (3, 1, 1)
    assert body["by_difficulty"]["easy"] == {"wins": 2, "losses": 1, "draws": 0}
    assert body["by_difficulty"]["medium"] == {"wins": 1, "losses": 0, "draws": 1}
    assert body["avg_captured"] == 40.0
    assert body["current_streak"] == 2

    other = _client(b).get("/api/stats").json()
    assert other["total_games"] == 1 and other["losses"] == 1
    assert other["current_streak"] == 0


def test_streak_all_wins(db: Session, users: tuple[User, User]) -> None:
    _add(db, users[0], "easy", "human_won")
    _add(db, users[0], "easy", "human_won")
    assert _client(users[0]).get("/api/stats").json()["current_streak"] == 2
