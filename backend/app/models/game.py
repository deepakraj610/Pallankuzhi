"""Game model."""

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.move import Move
    from app.models.user import User


class Difficulty(str, enum.Enum):
    easy = "easy"
    medium = "medium"


class Player(str, enum.Enum):
    human = "human"
    ai = "ai"


class GameStatus(str, enum.Enum):
    in_progress = "in_progress"
    human_won = "human_won"
    ai_won = "ai_won"
    draw = "draw"
    abandoned = "abandoned"


class Game(Base, TimestampMixin):
    __tablename__ = "games"
    __table_args__ = (
        Index("ix_games_user_id_status", "user_id", "status"),
        Index(
            "ix_games_user_id_created_at_id",
            "user_id",
            text("created_at DESC"),
            text("id DESC"),
        ),
        CheckConstraint(
            "status IN ('in_progress','human_won','ai_won','draw','abandoned')",
            name="ck_games_status",
        ),
        CheckConstraint("difficulty IN ('easy','medium')", name="ck_games_difficulty"),
        CheckConstraint(
            "current_player IN ('human','ai')", name="ck_games_current_player"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    board: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    human_score: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    ai_score: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    current_player: Mapped[str] = mapped_column(
        String(10), default=Player.human.value, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20), default=GameStatus.in_progress.value, nullable=False
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="games")
    moves: Mapped[list["Move"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
        order_by="Move.move_number",
    )
