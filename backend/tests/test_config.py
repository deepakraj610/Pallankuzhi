import pytest

from app.config import Settings

SECRET = "x" * 40
DB = "postgresql://u:p@localhost:5433/db"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("http://localhost:3000", ["http://localhost:3000"]),
        ("http://a.test, http://b.test", ["http://a.test", "http://b.test"]),
        ('["http://a.test"]', ["http://a.test"]),
    ],
)
def test_cors_origins_env_formats(
    monkeypatch: pytest.MonkeyPatch, raw: str, expected: list[str]
) -> None:
    monkeypatch.setenv("DATABASE_URL", DB)
    monkeypatch.setenv("SECRET_KEY", SECRET)
    monkeypatch.setenv("CORS_ORIGINS", raw)
    assert Settings().CORS_ORIGINS == expected  # type: ignore[call-arg]
