"""AI opponent: easy (random) and medium (greedy one-ply with reply tiebreak)."""

import random
from typing import Literal

from app.services.game_engine import (
    AI,
    Board,
    Player,
    apply_move,
    opponent,
    valid_moves,
)

Difficulty = Literal["easy", "medium"]


def _best_reply_capture(board: Board, player: Player) -> int:
    moves = valid_moves(board, player)
    return max((apply_move(board, player, m).seeds_captured for m in moves), default=0)


def choose_move(
    board: Board,
    difficulty: Difficulty,
    rng: random.Random | None = None,
    player: Player = AI,
) -> int:
    """Pick a cup for `player` (default AI). Raises ValueError if no moves."""
    rng = rng or random.Random()
    moves = valid_moves(board, player)
    if not moves:
        raise ValueError("no valid moves")
    if difficulty == "easy":
        return rng.choice(moves)
    if difficulty != "medium":
        raise ValueError(f"unknown difficulty: {difficulty}")

    scored: list[tuple[int, int, int]] = []  # (capture, -opponent best reply, move)
    for m in moves:
        res = apply_move(board, player, m)
        reply = (
            0 if res.is_game_over else _best_reply_capture(res.board, opponent(player))
        )
        scored.append((res.seeds_captured, -reply, m))
    best = max((c, r) for c, r, _ in scored)
    return rng.choice([m for c, r, m in scored if (c, r) == best])
