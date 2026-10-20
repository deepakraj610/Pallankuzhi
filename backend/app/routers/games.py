"""Games endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.game import (
    GameCreate,
    GameList,
    GameRead,
    GameSummary,
    MoveCreate,
    MoveRead,
    MoveResponse,
    StatusLiteral,
    SweepStepRead,
    TraceStepRead,
)
from app.services import game_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/games", tags=["games"])

DbDep = Annotated[Session, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


@router.post("", response_model=GameRead, status_code=status.HTTP_201_CREATED)
def create_game(payload: GameCreate, db: DbDep, user: UserDep) -> GameRead:
    game = game_service.create_game(db, user.id, payload.difficulty)
    return GameRead.model_validate(game)


@router.get("", response_model=GameList)
def list_games(
    db: DbDep,
    user: UserDep,
    status_filter: Annotated[StatusLiteral | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> GameList:
    games, total = game_service.list_games(db, user.id, status_filter, page, page_size)
    return GameList(
        items=[GameSummary.model_validate(g) for g in games],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{game_id}", response_model=GameRead)
def get_game(game_id: int, db: DbDep, user: UserDep) -> GameRead:
    return GameRead.model_validate(game_service.get_game(db, user.id, game_id))


@router.post("/{game_id}/moves", response_model=MoveResponse)
def make_move(
    game_id: int, payload: MoveCreate, db: DbDep, user: UserDep
) -> MoveResponse:
    outcome = game_service.play_human_move(db, user.id, game_id, payload.cup_index)
    return MoveResponse(
        game=GameRead.model_validate(outcome.game),
        human_move=MoveRead.model_validate(outcome.human_move),
        ai_move=MoveRead.model_validate(outcome.ai_move) if outcome.ai_move else None,
        human_trace=[TraceStepRead.model_validate(t) for t in outcome.human_trace],
        ai_trace=[TraceStepRead.model_validate(t) for t in outcome.ai_trace],
        sweep=[SweepStepRead.model_validate(s) for s in outcome.sweep],
    )


@router.delete("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def abandon_game(game_id: int, db: DbDep, user: UserDep) -> Response:
    game_service.abandon_game(db, user.id, game_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
