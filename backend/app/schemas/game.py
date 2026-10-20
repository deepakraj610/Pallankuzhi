"""Pydantic schemas for the games module."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DifficultyLiteral = Literal["easy", "medium"]
StatusLiteral = Literal["in_progress", "human_won", "ai_won", "draw", "abandoned"]
PlayerLiteral = Literal["human", "ai"]


class GameCreate(BaseModel):
    difficulty: DifficultyLiteral


class MoveCreate(BaseModel):
    cup_index: int


class MoveRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    game_id: int
    move_number: int
    player: PlayerLiteral
    cup_index: int
    seeds_sown: int
    seeds_captured: int
    board_after: list[int]
    created_at: datetime


class GameSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    difficulty: DifficultyLiteral
    board: list[int]
    human_score: int
    ai_score: int
    current_player: PlayerLiteral
    status: StatusLiteral
    created_at: datetime
    updated_at: datetime | None = None
    finished_at: datetime | None = None


class GameRead(GameSummary):
    moves: list[MoveRead] = Field(default_factory=list)


class GameList(BaseModel):
    items: list[GameSummary]
    total: int
    page: int
    page_size: int


class TraceStepRead(BaseModel):
    """One sowing step for the client animation (not persisted)."""

    model_config = ConfigDict(from_attributes=True)

    kind: Literal["pickup", "drop", "capture"]
    cup: int
    count: int = 1


class SweepStepRead(BaseModel):
    """End-of-game sweep step: leftover seeds in `cup` go to `owner` (not persisted)."""

    model_config = ConfigDict(from_attributes=True)

    cup: int
    count: int
    owner: PlayerLiteral


class MoveResponse(BaseModel):
    game: GameRead
    human_move: MoveRead
    ai_move: MoveRead | None = None
    human_trace: list[TraceStepRead] = Field(default_factory=list)
    ai_trace: list[TraceStepRead] = Field(default_factory=list)
    sweep: list[SweepStepRead] = Field(default_factory=list)
