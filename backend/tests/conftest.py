"""Shared test configuration: points the app at the test Postgres (port 5433)."""

import os

import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://pk:pw@localhost:5433/pk")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-123")


@pytest.fixture(autouse=True)
def _reset_rate_limiters() -> None:
    from app.services import auth_service

    auth_service.reset_limiters()
