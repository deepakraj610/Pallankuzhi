"""Table-driven tests for the classic relay rules in the pure game engine."""

import random

import pytest

from app.services import game_engine as eng


def _board(**cups: int) -> list[int]:
    """Build a board from keyword args like c3=2 (all other cups empty)."""
    board = [0] * eng.NUM_CUPS
    for key, value in cups.items():
        board[int(key[1:])] = value
    return board


@pytest.mark.parametrize(
    ("start", "cup", "expected_last", "expected"),
    [
        # simple sow, no wrap
        ([5] * 14, 0, 5, [0, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5]),
        # wrap-around the end of the board
        ([5] * 14, 12, 3, [6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5, 0, 6]),
        # exactly one full lap lands the last seed in the origin cup
        (_board(c0=14), 0, 0, [1] * 14),
        # more than a lap: origin receives a seed and sowing continues
        (_board(c0=15), 0, 1, [1, 2] + [1] * 12),
        # single seed wraps from the last cup to the first
        (_board(c13=1), 13, 0, _board(c0=1)),
    ],
)
def test_sow_seeds_table(
    start: list[int], cup: int, expected_last: int, expected: list[int]
) -> None:
    new, last = eng.sow_seeds(start, cup)
    assert last == expected_last
    assert new == expected
    assert sum(new) == sum(start)


def test_sow_empty_cup_raises() -> None:
    with pytest.raises(ValueError):
        eng.sow_seeds([0] * 14, 3)


@pytest.mark.parametrize(
    ("start", "last", "expected_board", "expected_captured"),
    [
        # next cup empty, cup after it has seeds: capture it
        (_board(c2=1, c4=7), 2, _board(c2=1), 7),
        # next cup empty, cup after it empty too: no capture
        (_board(c2=1), 2, _board(c2=1), 0),
        # capture wraps around the end of the board
        (_board(c12=1, c0=4), 12, _board(c12=1), 4),
        # relay: cup 3 is picked up and sown (cups 4,5), then cup 7 is captured
        (_board(c2=1, c3=2, c5=3, c7=4), 2, _board(c2=1, c4=1, c5=4), 4),
        # relay then empty target: nothing captured, relay still happened
        (_board(c2=1, c3=2), 2, _board(c2=1, c4=1, c5=1), 0),
        # relay chain: c1 -> c2, c2(2)... see test_relay_chain_exact for detail
        (_board(c0=1, c1=1, c2=1, c4=9), 0, _board(c0=1, c2=2), 9),
        # two relays before the capture
        (
            _board(c0=1, c1=1, c2=1, c3=1, c6=5),
            0,
            _board(c0=1, c2=2, c4=1),
            5,
        ),
    ],
)
def test_resolve_capture_table(
    start: list[int],
    last: int,
    expected_board: list[int],
    expected_captured: int,
) -> None:
    new, captured = eng.resolve_capture(start, last)
    assert captured == expected_captured
    assert new == expected_board
    assert sum(new) + captured == sum(start)


def test_resolve_capture_relay_limit() -> None:
    # A board of single seeds relays for a long time; seeds must be conserved
    board = [1] * 14
    new, captured = eng.resolve_capture(board, 0)
    assert sum(new) + captured == 14


def test_apply_move_capture_and_turn_end() -> None:
    board = _board(c0=1, c3=6, c7=3)
    res = eng.apply_move(board, eng.HUMAN, 0)
    assert res.seeds_sown == 1
    assert res.seeds_captured == 6
    assert res.board == _board(c1=1, c7=3)
    assert res.human_score == 6 and res.ai_score == 0
    assert res.player == "human" and res.next_player == "ai"
    assert res.is_game_over is False


def test_apply_move_ai_scores_and_accumulates() -> None:
    board = _board(c7=1, c10=4, c0=2)
    res = eng.apply_move(board, eng.AI, 7, human_score=3, ai_score=10)
    assert res.ai_score == 14 and res.human_score == 3
    assert res.next_player == "human"


def test_apply_move_game_over_when_opponent_side_empty() -> None:
    board = _board(c0=1, c3=6)
    res = eng.apply_move(board, eng.HUMAN, 0)
    assert res.is_game_over is True


@pytest.mark.parametrize(
    ("player", "cup"),
    [("human", 7), ("human", 3), ("ai", 0), ("human", -1), ("human", 14)],
)
def test_apply_move_illegal(player: eng.Player, cup: int) -> None:
    board = _board(c0=1, c9=2)
    with pytest.raises(ValueError):
        eng.apply_move(board, player, cup)


@pytest.mark.parametrize(
    ("board", "player", "expected"),
    [
        ([5] * 14, "human", [0, 1, 2, 3, 4, 5, 6]),
        ([5] * 14, "ai", [7, 8, 9, 10, 11, 12, 13]),
        (_board(c1=1, c8=2, c13=1), "human", [1]),
        (_board(c1=1, c8=2, c13=1), "ai", [8, 13]),
        ([0] * 14, "human", []),
    ],
)
def test_valid_moves(board: list[int], player: eng.Player, expected: list[int]) -> None:
    assert eng.valid_moves(board, player) == expected


@pytest.mark.parametrize(
    ("board", "next_player", "expected"),
    [
        ([5] * 14, "human", False),
        ([0] * 14, "human", True),
        (_board(c0=3), "ai", True),
        (_board(c0=3), "human", False),
        (_board(c8=3), "human", True),
    ],
)
def test_is_game_over(
    board: list[int], next_player: eng.Player, expected: bool
) -> None:
    assert eng.is_game_over(board, next_player) is expected


@pytest.mark.parametrize(
    ("board", "hs", "ais", "winner", "h_total", "a_total"),
    [
        (_board(c0=2, c9=1), 30, 30, "human", 32, 31),
        (_board(c0=1, c9=3), 30, 30, "ai", 31, 33),
        (_board(c0=2, c9=2), 30, 30, "draw", 32, 32),
        ([0] * 14, 40, 30, "human", 40, 30),
    ],
)
def test_final_result_sweep(
    board: list[int], hs: int, ais: int, winner: str, h_total: int, a_total: int
) -> None:
    res = eng.final_result(board, hs, ais)
    assert res.board == [0] * 14
    assert (res.human_score, res.ai_score) == (h_total, a_total)
    assert res.winner == winner


def test_helpers() -> None:
    assert eng.opponent("human") == "ai" and eng.opponent("ai") == "human"
    assert eng.new_board() == [5] * 14 and sum(eng.new_board()) == eng.TOTAL_SEEDS
    assert list(eng.side_range("human")) == list(range(7))
    assert list(eng.side_range("ai")) == list(range(7, 14))


def test_input_board_never_mutated() -> None:
    board = [5, 0, 3, 2, 7, 1, 4, 5, 6, 0, 2, 8, 1, 3]
    snapshot = list(board)
    eng.sow_seeds(board, 0)
    eng.resolve_capture(board, 4)
    eng.apply_move(board, eng.HUMAN, 0)
    eng.apply_move(board, eng.AI, 7)
    eng.final_result(board, 1, 2)
    eng.valid_moves(board, "human")
    eng.is_game_over(board, "ai")
    assert board == snapshot


def _play_random_game(rng: random.Random, max_moves: int = 5000) -> int:
    board = eng.new_board()
    human_score = 0
    ai_score = 0
    player: eng.Player = eng.HUMAN
    for n in range(1, max_moves + 1):
        cup = rng.choice(eng.valid_moves(board, player))
        res = eng.apply_move(board, player, cup, human_score, ai_score)
        board = res.board
        human_score, ai_score = res.human_score, res.ai_score
        assert all(c >= 0 for c in board)
        assert sum(board) + human_score + ai_score == eng.TOTAL_SEEDS
        if res.is_game_over:
            final = eng.final_result(board, human_score, ai_score)
            assert final.human_score + final.ai_score == eng.TOTAL_SEEDS
            assert sum(final.board) == 0
            return n
        player = res.next_player
    raise AssertionError("game did not terminate")


def test_random_playouts_conserve_seeds_and_terminate() -> None:
    rng = random.Random(20240601)
    lengths = [_play_random_game(rng) for _ in range(300)]
    assert min(lengths) >= 1


def _replay(board: list[int], trace: tuple[eng.TraceStep, ...]) -> list[int]:
    """Re-apply a trace to the starting board, as the client animation does."""
    out = list(board)
    for step in trace:
        if step.kind == "pickup":
            out[step.cup] = 0
        elif step.kind == "drop":
            out[step.cup] += 1
        else:
            out[step.cup] = 0
    return out


def test_trace_describes_sow_relay_and_capture() -> None:
    board = [0] * 14
    board[0], board[2], board[3] = 2, 1, 4
    res = eng.apply_move(board, eng.HUMAN, 0)
    kinds = [(s.kind, s.cup) for s in res.trace]
    assert kinds[0] == ("pickup", 0)
    assert kinds[1:3] == [("drop", 1), ("drop", 2)]
    assert any(k == "pickup" for k, _ in kinds[3:])  # relay from cup 3
    assert _replay(board, res.trace) == res.board


def test_trace_replay_matches_board_over_random_games() -> None:
    import random

    rng = random.Random(7)
    for _ in range(60):
        board, h, a, player = eng.new_board(), 0, 0, eng.HUMAN
        while True:
            move = rng.choice(eng.valid_moves(board, player))
            res = eng.apply_move(board, player, move, h, a)
            assert _replay(board, res.trace) == res.board
            captured = sum(s.count for s in res.trace if s.kind == "capture")
            assert captured == res.seeds_captured
            board, h, a = res.board, res.human_score, res.ai_score
            if res.is_game_over:
                break
            player = res.next_player


def test_final_result_reports_sweep_steps_per_owner() -> None:
    board = [0] * 14
    board[1], board[4], board[9] = 2, 3, 6
    res = eng.final_result(board, 10, 20)
    assert [(s.cup, s.count, s.owner) for s in res.sweep] == [
        (1, 2, "human"),
        (4, 3, "human"),
        (9, 6, "ai"),
    ]
    assert res.human_score == 15
    assert res.ai_score == 26
    assert res.board == [0] * 14


def test_final_result_sweep_empty_when_board_empty() -> None:
    assert eng.final_result([0] * 14, 30, 40).sweep == ()
