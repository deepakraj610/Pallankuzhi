"""Stats schemas (mirror frontend types Stats / DifficultyRecord)."""

from pydantic import BaseModel


class DifficultyRecord(BaseModel):
    wins: int = 0
    losses: int = 0
    draws: int = 0


class StatsResponse(BaseModel):
    total_games: int
    wins: int
    losses: int
    draws: int
    by_difficulty: dict[str, DifficultyRecord]
    avg_captured: float
    current_streak: int
