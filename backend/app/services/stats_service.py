"""Aggregate game statistics for a user using SQL aggregation."""

import logging

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.models.game import Difficulty, Game, GameStatus, Player
from app.models.move import Move
from app.schemas.stats import DifficultyRecord, StatsResponse

logger = logging.getLogger(__name__)

FINISHED = (GameStatus.human_won.value, GameStatus.ai_won.value, GameStatus.draw.value)


def get_user_stats(db: Session, user_id: int) -> StatsResponse:
    wins = func.coalesce(
        func.sum(case((Game.status == GameStatus.human_won.value, 1), else_=0)), 0
    )
    losses = func.coalesce(
        func.sum(case((Game.status == GameStatus.ai_won.value, 1), else_=0)), 0
    )
    draws = func.coalesce(
        func.sum(case((Game.status == GameStatus.draw.value, 1), else_=0)), 0
    )

    rows = db.execute(
        select(
            Game.difficulty,
            wins,
            losses,
            draws,
        )
        .where(Game.user_id == user_id, Game.status.in_(FINISHED))
        .group_by(Game.difficulty)
    ).all()

    by_difficulty: dict[str, DifficultyRecord] = {
        d.value: DifficultyRecord() for d in Difficulty
    }
    total_w = total_l = total_d = 0
    for difficulty, w, lo, dr in rows:  # one row per difficulty (<= few rows)
        by_difficulty[difficulty] = DifficultyRecord(
            wins=int(w), losses=int(lo), draws=int(dr)
        )
        total_w += int(w)
        total_l += int(lo)
        total_d += int(dr)
    total = total_w + total_l + total_d

    # Seeds the human actually captured by moving (excludes end-of-game sweeps).
    captured = int(
        db.execute(
            select(func.coalesce(func.sum(Move.seeds_captured), 0))
            .join(Game, Game.id == Move.game_id)
            .where(
                Game.user_id == user_id,
                Game.status.in_(FINISHED),
                Move.player == Player.human.value,
            )
        ).scalar_one()
    )

    # Streak: wins after the most recent finished non-win game, ordered by
    # (finished_at, id); finished_at falls back to created_at if unset.
    when = func.coalesce(Game.finished_at, Game.created_at)
    last_loss = db.execute(
        select(when, Game.id)
        .where(
            Game.user_id == user_id,
            Game.status.in_((GameStatus.ai_won.value, GameStatus.draw.value)),
        )
        .order_by(when.desc(), Game.id.desc())
        .limit(1)
    ).first()
    streak_q = select(func.count(Game.id)).where(
        Game.user_id == user_id, Game.status == GameStatus.human_won.value
    )
    if last_loss is not None:
        loss_when, loss_id = last_loss
        streak_q = streak_q.where(
            or_(when > loss_when, and_(when == loss_when, Game.id > loss_id))
        )
    streak = db.execute(streak_q).scalar_one()

    logger.debug("Computed stats for user %s: %s finished games", user_id, total)
    return StatsResponse(
        total_games=total,
        wins=total_w,
        losses=total_l,
        draws=total_d,
        by_difficulty=by_difficulty,
        avg_captured=round(captured / total, 2) if total else 0.0,
        current_streak=int(streak),
    )
