"""Pure Pallankuzhi game engine. No framework / I/O imports.

Board: 14 cups. Indexes 0-6 belong to the human, 7-13 to the AI. Sowing goes in
increasing index order, wrapping modulo 14. Invariant: sum(board) + human_score
+ ai_score == TOTAL_SEEDS. All functions are non-mutating.
"""

import logging
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger(__name__)

Player = Literal["human", "ai"]
Board = list[int]
TraceKind = Literal["pickup", "drop", "capture"]

NUM_CUPS = 14
SEEDS_PER_CUP = 5
TOTAL_SEEDS = NUM_CUPS * SEEDS_PER_CUP  # 70
HUMAN: Player = "human"
AI: Player = "ai"


@dataclass(frozen=True)
class TraceStep:
    """One animation step: seeds picked up, a single seed dropped, or seeds captured."""

    kind: TraceKind
    cup: int
    count: int = 1


@dataclass(frozen=True)
class MoveResult:
    board: Board
    human_score: int
    ai_score: int
    seeds_sown: int
    seeds_captured: int
    player: Player
    next_player: Player
    is_game_over: bool
    trace: tuple[TraceStep, ...] = ()


@dataclass(frozen=True)
class SweepStep:
    """Leftover seeds in `cup` go to `owner` (the player whose side the cup is on)."""

    cup: int
    count: int
    owner: Player


@dataclass(frozen=True)
class GameResult:
    board: Board
    human_score: int
    ai_score: int
    winner: Literal["human", "ai", "draw"]
    sweep: tuple[SweepStep, ...] = ()


def opponent(player: Player) -> Player:
    return AI if player == HUMAN else HUMAN


def side_range(player: Player) -> range:
    return range(7) if player == HUMAN else range(7, 14)


def new_board() -> Board:
    return [SEEDS_PER_CUP] * NUM_CUPS


def valid_moves(board: Board, player: Player) -> list[int]:
    """Non-empty cups on the player's own side."""
    return [i for i in side_range(player) if board[i] > 0]


def sow_seeds(
    board: Board, cup_index: int, trace: list[TraceStep] | None = None
) -> tuple[Board, int]:
    """Pick up all seeds in cup_index and sow one per cup (no cup skipped).

    Returns (new_board, last_cup). Seeds can land in the origin cup on laps.
    If `trace` is given, the pickup and every drop are appended to it.
    """
    new = list(board)
    seeds = new[cup_index]
    if seeds <= 0:
        raise ValueError(f"cup {cup_index} is empty")
    new[cup_index] = 0
    if trace is not None:
        trace.append(TraceStep("pickup", cup_index, seeds))
    pos = cup_index
    for _ in range(seeds):
        pos = (pos + 1) % NUM_CUPS
        new[pos] += 1
        if trace is not None:
            trace.append(TraceStep("drop", pos))
    return new, pos


MAX_RELAYS = 1000

# House rule: with seeds left to chase, two players can circle forever without ever being
# close enough to capture. After this many consecutive moves with no capture (half each)
# the game is declared a stalemate and each side keeps the seeds on its own side.
STALEMATE_MOVES = 40


def resolve_capture(
    board: Board, last_cup: int, trace: list[TraceStep] | None = None
) -> tuple[Board, int]:
    """Classic relay capture rule (isolated so it is easy to change).

    After the last seed lands in last_cup: if the next cup is non-empty, pick it
    up and keep sowing from it (relay), repeating. If the next cup is empty, the
    player captures the cup after that (if non-empty) and the turn ends.
    Relay pickups, drops and the capture are appended to `trace` when given.
    """
    new = list(board)
    pos = last_cup
    for _ in range(MAX_RELAYS):
        nxt = (pos + 1) % NUM_CUPS
        if new[nxt] == 0:
            target = (nxt + 1) % NUM_CUPS
            captured = new[target]
            new[target] = 0
            if trace is not None and captured > 0:
                trace.append(TraceStep("capture", target, captured))
            return new, captured
        new, pos = sow_seeds(new, nxt, trace)
    logger.warning("relay limit reached; ending turn without capture")
    return new, 0


def is_game_over(board: Board, next_player: Player) -> bool:
    """Over when no seeds remain, or the player to move has none on their side."""
    return sum(board) == 0 or not valid_moves(board, next_player)


def apply_move(
    board: Board,
    player: Player,
    cup_index: int,
    human_score: int = 0,
    ai_score: int = 0,
) -> MoveResult:
    """Validate and apply a move. Raises ValueError for illegal moves."""
    if cup_index not in valid_moves(board, player):
        raise ValueError(f"illegal move: cup {cup_index} for {player}")
    seeds_sown = board[cup_index]
    trace: list[TraceStep] = []
    sown_board, last = sow_seeds(board, cup_index, trace)
    result_board, captured = resolve_capture(sown_board, last, trace)
    if player == HUMAN:
        human_score += captured
    else:
        ai_score += captured
    nxt = opponent(player)
    logger.debug(
        "%s played %d sown=%d captured=%d", player, cup_index, seeds_sown, captured
    )
    return MoveResult(
        board=result_board,
        human_score=human_score,
        ai_score=ai_score,
        seeds_sown=seeds_sown,
        seeds_captured=captured,
        player=player,
        next_player=nxt,
        is_game_over=is_game_over(result_board, nxt),
        trace=tuple(trace),
    )


def final_result(board: Board, human_score: int, ai_score: int) -> GameResult:
    """Sweep remaining seeds to the owner of each side, then decide the winner."""
    sweep = tuple(
        SweepStep(i, board[i], player)
        for player in (HUMAN, AI)
        for i in side_range(player)
        if board[i] > 0
    )
    human_score += sum(s.count for s in sweep if s.owner == HUMAN)
    ai_score += sum(s.count for s in sweep if s.owner == AI)
    if human_score > ai_score:
        winner: Literal["human", "ai", "draw"] = "human"
    elif ai_score > human_score:
        winner = "ai"
    else:
        winner = "draw"
    return GameResult([0] * NUM_CUPS, human_score, ai_score, winner, sweep)
