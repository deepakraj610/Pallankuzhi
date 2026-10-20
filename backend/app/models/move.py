"""Move model."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.types import JSON

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.game import Game


class Move(Base):
    __tablename__ = "moves"
    __table_args__ = (
        CheckConstraint("player IN ('human','ai')", name="ck_moves_player"),
        UniqueConstraint("game_id", "move_number", name="uq_moves_game_id_move_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    game_id: Mapped[int] = mapped_column(
        ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    move_number: Mapped[int] = mapped_column(Integer, nullable=False)
    player: Mapped[str] = mapped_column(String(10), nullable=False)
    cup_index: Mapped[int] = mapped_column(Integer, nullable=False)
    seeds_sown: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    seeds_captured: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    board_after: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    game: Mapped["Game"] = relationship(back_populates="moves")
