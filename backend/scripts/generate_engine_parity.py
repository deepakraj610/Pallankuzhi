"""Writes frontend/src/engine/__fixtures__/parity.json from the Python engine.

The standalone (offline) app runs a TypeScript port of the engine; the frontend tests replay these
cases against it so the two implementations cannot drift apart. Run from backend/:

    python scripts/generate_engine_parity.py
"""

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import game_engine as eng  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "frontend/src/engine/__fixtures__/parity.json"
GAMES = 30
SAMPLE_EVERY = 4


def trace_rows(trace: tuple[eng.TraceStep, ...]) -> list[list[object]]:
    return [[s.kind, s.cup, s.count] for s in trace]


def main() -> None:
    rng = random.Random(20261021)
    moves: list[dict[str, object]] = []
    finals: list[dict[str, object]] = []
    for _ in range(GAMES):
        board, h, a, player, n = eng.new_board(), 0, 0, eng.HUMAN, 0
        while True:
            cup = rng.choice(eng.valid_moves(board, player))
            res = eng.apply_move(board, player, cup, h, a)
            if n < 6 or n % SAMPLE_EVERY == 0 or res.is_game_over:
                moves.append(
                    {
                        "board": board,
                        "player": player,
                        "cup": cup,
                        "humanScore": h,
                        "aiScore": a,
                        "expected": {
                            "board": res.board,
                            "humanScore": res.human_score,
                            "aiScore": res.ai_score,
                            "seedsSown": res.seeds_sown,
                            "seedsCaptured": res.seeds_captured,
                            "nextPlayer": res.next_player,
                            "isGameOver": res.is_game_over,
                            "trace": trace_rows(res.trace),
                        },
                    }
                )
            board, h, a, n = res.board, res.human_score, res.ai_score, n + 1
            if res.is_game_over:
                final = eng.final_result(board, h, a)
                finals.append(
                    {
                        "board": board,
                        "humanScore": h,
                        "aiScore": a,
                        "expected": {
                            "humanScore": final.human_score,
                            "aiScore": final.ai_score,
                            "winner": final.winner,
                            "sweep": [[s.cup, s.count, s.owner] for s in final.sweep],
                        },
                    }
                )
                break
            player = res.next_player
    OUT.write_text(json.dumps({"moves": moves, "finals": finals}, separators=(",", ":")) + "\n")
    print(f"wrote {len(moves)} move cases and {len(finals)} final cases to {OUT}")


if __name__ == "__main__":
    main()
