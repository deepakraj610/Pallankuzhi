"""Tests for the AI opponent (easy random, medium greedy)."""

import random

import pytest

from app.services import game_engine as eng
from app.services.ai_opponent import choose_move


def _board(**cups: int) -> list[int]:
    board = [0] * eng.NUM_CUPS
    for key, value in cups.items():
        board[int(key[1:])] = value
    return board


def test_easy_returns_only_legal_moves() -> None:
    rng = random.Random(1)
    board = _board(c7=1, c9=3, c13=2, c0=4)
    seen = {choose_move(board, "easy", rng) for _ in range(200)}
    assert seen == {7, 9, 13}


def test_easy_legal_on_random_boards() -> None:
    rng = random.Random(7)
    for _ in range(200):
        board = [rng.randint(0, 4) for _ in range(14)]
        for player in (eng.AI, eng.HUMAN):
            moves = eng.valid_moves(board, player)
            if not moves:
                continue
            assert choose_move(board, "easy", rng, player) in moves


def test_medium_picks_max_capture_move() -> None:
    # Cup 7 captures cup 10 (6 seeds); cups 10 and 12 capture nothing.
    board = _board(c0=3, c7=1, c10=6, c12=1)
    for seed in range(10):
        assert choose_move(board, "medium", random.Random(seed)) == 7


def test_medium_for_human_player() -> None:
    board = _board(c0=1, c3=6, c5=1, c13=2)
    assert choose_move(board, "medium", random.Random(0), player=eng.HUMAN) == 0


def test_medium_tie_break_random_among_best_and_legal() -> None:
    # Two symmetric moves with identical capture/reply outcomes.
    board = _board(c7=1, c8=1, c0=1)
    moves = eng.valid_moves(board, eng.AI)
    picks = {choose_move(board, "medium", random.Random(s)) for s in range(60)}
    assert picks <= set(moves)


def test_medium_chosen_move_is_optimal_by_capture_then_reply() -> None:
    rng = random.Random(99)
    for _ in range(40):
        board = [rng.randint(0, 6) for _ in range(14)]
        moves = eng.valid_moves(board, eng.AI)
        if not moves or eng.is_game_over(board, eng.AI):
            continue
        scored: dict[int, tuple[int, int]] = {}
        for m in moves:
            res = eng.apply_move(board, eng.AI, m)
            reply = 0
            if not res.is_game_over:
                reply = max(
                    eng.apply_move(res.board, eng.HUMAN, h).seeds_captured
                    for h in eng.valid_moves(res.board, eng.HUMAN)
                )
            scored[m] = (res.seeds_captured, -reply)
        chosen = choose_move(board, "medium", rng)
        assert scored[chosen] == max(scored.values())


def test_no_moves_raises() -> None:
    with pytest.raises(ValueError, match="no valid moves"):
        choose_move([0] * 14, "easy")
    with pytest.raises(ValueError, match="no valid moves"):
        choose_move(_board(c0=3), "medium")


def test_unknown_difficulty_raises() -> None:
    with pytest.raises(ValueError, match="unknown difficulty"):
        choose_move([5] * 14, "hard")  # type: ignore[arg-type]


def test_default_rng_used_when_none() -> None:
    assert choose_move([5] * 14, "easy") in range(7, 14)


def _play(medium_is_human: bool, rng: random.Random) -> str:
    """Return 'medium', 'easy' or 'draw' for one full game."""
    board = eng.new_board()
    scores = {"human": 0, "ai": 0}
    player: eng.Player = eng.HUMAN
    medium_player: eng.Player = eng.HUMAN if medium_is_human else eng.AI
    for _ in range(3000):
        diff = "medium" if player == medium_player else "easy"
        cup = choose_move(board, diff, rng, player)
        res = eng.apply_move(board, player, cup, scores["human"], scores["ai"])
        board = res.board
        scores = {"human": res.human_score, "ai": res.ai_score}
        if res.is_game_over:
            final = eng.final_result(board, scores["human"], scores["ai"])
            if final.winner == "draw":
                return "draw"
            return "medium" if final.winner == medium_player else "easy"
        player = res.next_player
    raise AssertionError("game did not terminate")


def test_medium_beats_easy_clearly() -> None:
    rng = random.Random(12345)
    results = [_play(i % 2 == 0, rng) for i in range(60)]
    medium = results.count("medium")
    easy = results.count("easy")
    assert medium > easy
    assert medium >= 0.6 * 60 or medium >= easy + 12
