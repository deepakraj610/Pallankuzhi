"""Game orchestration: persistence around the pure engine."""

import logging
from datetime import UTC, datetime
from typing import NamedTuple, cast

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.exceptions import ConflictError, InvalidMoveError, NotFoundError
from app.models.game import Difficulty, Game, GameStatus, Player
from app.models.move import Move
from app.services import game_engine as engine
from app.services.ai_opponent import Difficulty as AIDifficulty
from app.services.ai_opponent import choose_move

logger = logging.getLogger(__name__)


def create_game(db: Session, user_id: int, difficulty: str) -> Game:
    game = Game(
        user_id=user_id,
        difficulty=Difficulty(difficulty).value,
        board=engine.new_board(),
        human_score=0,
        ai_score=0,
        current_player=Player.human.value,
        status=GameStatus.in_progress.value,
    )
    db.add(game)
    db.commit()
    db.refresh(game)
    return game


def list_games(
    db: Session, user_id: int, status: str | None, page: int, page_size: int
) -> tuple[list[Game], int]:
    base = select(Game).where(Game.user_id == user_id)
    if status:
        base = base.where(Game.status == status)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    items = list(
        db.scalars(
            base.order_by(Game.created_at.desc(), Game.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return items, total


def get_game(db: Session, user_id: int, game_id: int, lock: bool = False) -> Game:
    stmt = select(Game).where(Game.id == game_id, Game.user_id == user_id)
    if lock:
        stmt = stmt.with_for_update()
    game = db.scalar(stmt)
    if game is None:
        raise NotFoundError("Game")
    return game


def abandon_game(db: Session, user_id: int, game_id: int) -> None:
    game = get_game(db, user_id, game_id, lock=True)
    if game.status != GameStatus.in_progress.value:
        raise ConflictError("Game is not in progress")
    game.status = GameStatus.abandoned.value
    game.finished_at = datetime.now(UTC)
    db.commit()


def _record_move(
    db: Session, game: Game, result: engine.MoveResult, cup_index: int, number: int
) -> Move:
    move = Move(
        game_id=game.id,
        move_number=number,
        player=result.player,
        cup_index=cup_index,
        seeds_sown=result.seeds_sown,
        seeds_captured=result.seeds_captured,
        board_after=list(result.board),
    )
    db.add(move)
    game.board = list(result.board)
    game.human_score = result.human_score
    game.ai_score = result.ai_score
    game.current_player = result.next_player
    return move


def _is_stalemate(db: Session, game_id: int) -> bool:
    """True when the last STALEMATE_MOVES moves all captured nothing."""
    recent = list(
        db.scalars(
            select(Move.seeds_captured)
            .where(Move.game_id == game_id)
            .order_by(Move.move_number.desc())
            .limit(engine.STALEMATE_MOVES)
        )
    )
    return len(recent) == engine.STALEMATE_MOVES and not any(recent)


def _finalize(game: Game) -> tuple[engine.SweepStep, ...]:
    final = engine.final_result(game.board, game.human_score, game.ai_score)
    game.board = list(final.board)
    game.human_score = final.human_score
    game.ai_score = final.ai_score
    game.status = {
        "human": GameStatus.human_won,
        "ai": GameStatus.ai_won,
        "draw": GameStatus.draw,
    }[final.winner].value
    game.finished_at = datetime.now(UTC)
    return final.sweep


class MoveOutcome(NamedTuple):
    game: Game
    human_move: Move
    ai_move: Move | None
    human_trace: tuple[engine.TraceStep, ...]
    ai_trace: tuple[engine.TraceStep, ...]
    sweep: tuple[engine.SweepStep, ...]


def play_human_move(
    db: Session, user_id: int, game_id: int, cup_index: int
) -> MoveOutcome:
    """Apply the human move and the AI reply in a single transaction."""
    game = get_game(db, user_id, game_id, lock=True)
    if game.status != GameStatus.in_progress.value:
        raise ConflictError("Game is not in progress")
    if not 0 <= cup_index < engine.NUM_CUPS:
        raise InvalidMoveError("Cup index out of range")
    if cup_index not in engine.side_range(engine.HUMAN):
        raise InvalidMoveError("Cannot play the opponent's cup")
    if game.board[cup_index] <= 0:
        raise InvalidMoveError("Cannot play an empty cup")

    last_number = db.scalar(
        select(func.max(Move.move_number)).where(Move.game_id == game.id)
    )
    number = (last_number or 0) + 1
    try:
        human_res = engine.apply_move(
            game.board, engine.HUMAN, cup_index, game.human_score, game.ai_score
        )
        human_move = _record_move(db, game, human_res, cup_index, number)
        ai_move: Move | None = None
        ai_trace: tuple[engine.TraceStep, ...] = ()
        sweep: tuple[engine.SweepStep, ...] = ()
        over = human_res.is_game_over
        if not over:
            ai_cup = choose_move(game.board, cast(AIDifficulty, game.difficulty))
            ai_res = engine.apply_move(
                game.board, engine.AI, ai_cup, game.human_score, game.ai_score
            )
            ai_move = _record_move(db, game, ai_res, ai_cup, number + 1)
            ai_trace = ai_res.trace
            over = ai_res.is_game_over
        if not over and _is_stalemate(db, game.id):
            logger.info("Game %s ended in a stalemate", game.id)
            over = True
        if over:
            sweep = _finalize(game)
        db.commit()
    except ValueError as exc:
        db.rollback()
        raise InvalidMoveError(str(exc)) from exc
    except Exception:
        db.rollback()
        logger.exception("Failed to play move for game %s", game_id)
        raise
    db.refresh(game)
    db.refresh(human_move)
    if ai_move is not None:
        db.refresh(ai_move)
    return MoveOutcome(game, human_move, ai_move, human_res.trace, ai_trace, sweep)
