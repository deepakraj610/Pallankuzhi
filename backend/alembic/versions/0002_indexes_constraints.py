"""Games listing index, CHECK constraints and server defaults

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_games_user_id_created_at_id",
        "games",
        ["user_id", sa.text("created_at DESC"), sa.text("id DESC")],
    )
    op.create_check_constraint(
        "ck_games_status",
        "games",
        "status IN ('in_progress','human_won','ai_won','draw','abandoned')",
    )
    op.create_check_constraint(
        "ck_games_difficulty", "games", "difficulty IN ('easy','medium')"
    )
    op.create_check_constraint(
        "ck_games_current_player", "games", "current_player IN ('human','ai')"
    )
    op.create_check_constraint("ck_moves_player", "moves", "player IN ('human','ai')")
    op.alter_column("users", "is_active", server_default=sa.true())
    op.alter_column("users", "is_verified", server_default=sa.false())
    op.alter_column("refresh_tokens", "revoked", server_default=sa.false())
    op.alter_column("games", "human_score", server_default="0")
    op.alter_column("games", "ai_score", server_default="0")


def downgrade() -> None:
    op.alter_column("games", "ai_score", server_default=None)
    op.alter_column("games", "human_score", server_default=None)
    op.alter_column("refresh_tokens", "revoked", server_default=None)
    op.alter_column("users", "is_verified", server_default=None)
    op.alter_column("users", "is_active", server_default=None)
    op.drop_constraint("ck_moves_player", "moves", type_="check")
    op.drop_constraint("ck_games_current_player", "games", type_="check")
    op.drop_constraint("ck_games_difficulty", "games", type_="check")
    op.drop_constraint("ck_games_status", "games", type_="check")
    op.drop_index("ix_games_user_id_created_at_id", table_name="games")
