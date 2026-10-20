# Pallankuzhi

A single-player game of **Pallankuzhi** (also spelled Pallanguzhi), the traditional Tamil mancala.
You play against an AI opponent on a carved-wood board, sowing tamarind seeds pit by
pit, with a hand-paced animation, an hourglass while the opponent thinks, and an animated end-of-game
sweep.

It comes in two forms that share one UI:

| | Android app | Web app |
|---|---|---|
| Where the game runs | On your phone | In your browser, backed by a server |
| Accounts / login | None | Email + password, or Google |
| Saved games and stats | On the device | In PostgreSQL |
| Needs a server | No, fully offline | Yes (FastAPI + PostgreSQL) |

---

## Android app

**[Download the Android app: Pallankuzhi-1.0-release.apk](https://github.com/deepakraj610/Pallankuzhi/releases/download/v1.0.0/Pallankuzhi-1.0-release.apk)**
· [All releases](https://github.com/deepakraj610/Pallankuzhi/releases)

1. Download the APK onto your Android phone (Android 5.1 or newer).
2. Open it and allow "install unknown apps" for the app you opened it from, if asked.

If you have an earlier test build installed, uninstall it first: it was signed with a different key,
so Android will not install over it (uninstalling clears that build's saved games).

The app is the same React UI wrapped with [Capacitor](https://capacitorjs.com). There is no server and
no login: the game engine and AI run on the device and games are saved in local storage. To build
it yourself, see [frontend/ANDROID.md](frontend/ANDROID.md).

---

## How to play

**The board.** Two sides of seven pits, 14 in all, each starting with 5 seeds (70 in total). Your
pits are the right-hand column of the portrait board, with your first pit at the bottom. The
opponent's are the left-hand column. The two central troughs hold the seeds each side has captured.

**Your turn.** Tap one of your non-empty pits. All its seeds are lifted and sown one per pit,
counter-clockwise (up your column, then down the opponent's), including into the pit you started from
if there are enough seeds to lap the board.

**Relay and capture.** After the last seed lands:

- If the *next* pit has seeds, they are picked up and sowing **continues** from there (a relay),
  and this repeats.
- If the next pit is **empty**, you **capture the pit after it** (if it has seeds) and your turn ends.

**The end.** The game ends when no seeds are left, or when the player to move has none on their own
side. Each side then keeps the seeds still on its side, and the higher total wins (equal totals are a
draw).

**House rules.** Real Pallankuzhi has several regional variants. This implementation is a single
round, and it adds one rule of its own: if 40 moves in a row pass with no capture (20 each), two
players chasing single seeds could go on forever, so the game ends as a stalemate and each side keeps
the seeds on its own side. Multi-round play with refills and "debts", and capturing a pit that reaches
four seeds, are not implemented.

**The opponent.**

- **Easy** plays a random legal pit.
- **Medium** takes the biggest immediate capture, preferring moves that leave you the smallest best
  reply.

---

## Run the web version

You need Docker, or Python 3.11+ and Node 20+ with a PostgreSQL database.

### With Docker

```bash
cp .env.example .env
# Edit .env and set at least:
#   DB_PASSWORD   (required, no default)
#   SECRET_KEY    (required, 32+ characters)
#     python -c "import secrets; print(secrets.token_urlsafe(48))"

docker compose up -d --build
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API | http://localhost:8000 (docs at `/docs`) |

The database is not published to the host. The backend applies the migrations on start. A development
overlay with live reload is available:
`docker compose -f docker-compose.yml -f docker-compose.dev.yml up`.

### Without Docker

```bash
# Backend (from backend/)
pip install -r requirements-dev.txt
export DATABASE_URL=postgresql://user:password@localhost:5432/pallankuzhi
export SECRET_KEY=<at least 32 characters>
alembic upgrade head
uvicorn app.main:app --reload

# Frontend (from frontend/)
npm install
npm run dev
```

`frontend/.env.example` sets `VITE_API_URL` (default `http://localhost:8000`). The backend allows
the origins in `CORS_ORIGINS`, which includes the Vite dev server and `http://localhost:3000` by
default.

### Google sign-in (optional)

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and register
`<your backend URL>/auth/google/callback` as an authorised redirect URI in the Google Cloud console.
Without them, email and password sign-in still works, and the Google sign-in endpoint returns a
"not configured" error.

### Configuration

All settings are environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing key, at least 32 characters; placeholder values are rejected |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | Token lifetimes (30 min / 7 days) |
| `FRONTEND_URL`, `CORS_ORIGINS` | Where the web app is served, and which origins may call the API |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_REDIRECT_URI` | Optional Google sign-in |
| `ENABLE_DOCS` | Serve `/docs` and `/redoc` (default on) |
| `VITE_API_URL` | API address baked into the frontend build |

---

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Create an account, get tokens |
| POST | `/auth/refresh`, `/auth/logout` | Rotate or revoke a refresh token |
| GET | `/auth/me` | The signed-in user |
| GET | `/auth/google`, `/auth/google/callback` | Google sign-in |
| POST | `/api/games` | Start a game (`easy` or `medium`) |
| GET | `/api/games`, `/api/games/{id}` | List games, or one game with its moves |
| POST | `/api/games/{id}/moves` | Play a pit; returns your move, the AI's reply, and the sowing traces and end-of-game sweep used for the animation |
| DELETE | `/api/games/{id}` | Abandon a game |
| GET | `/api/stats` | Wins, losses, draws, average seeds captured, streak |
| GET | `/health` | Health check |

The server is authoritative: the client only sends which pit to play, and every move is validated and
every game is scoped to its owner.

---

## Tests and checks

```bash
# Backend (from backend/): needs a PostgreSQL database with migrations applied
pytest --cov=app --cov-fail-under=80
ruff check . && mypy app

# Frontend (from frontend/)
npm test
npm run lint && npm run type-check
```

The backend tests read `DATABASE_URL` and `SECRET_KEY` from the environment (by default they expect a
throwaway database `postgresql://pk:pw@localhost:5433/pk`, with `alembic upgrade head` already run).
There are 97 backend and 85 frontend tests. [GitHub Actions](.github/workflows/ci.yml) runs the same
checks plus dependency audits and a Docker build.

---

## How it is built

```
backend/                 FastAPI + SQLAlchemy + Alembic
  app/services/game_engine.py   Pure game engine (rules, sowing trace, sweep)
  app/services/ai_opponent.py   Easy / Medium opponents
  app/routers, schemas, auth    HTTP API, JWT and Google OAuth
  scripts/                      Generates the engine parity fixture
frontend/                React + TypeScript + Vite + Chakra UI + Framer Motion
  src/engine/                   TypeScript port of the engine and AI, plus on-device storage
  src/components/game/          Board, pits, seeds, troughs, hourglass
  src/lib/                      Seed layout and sowing-animation planning
  android/                      Capacitor Android project
```

- **Two engines, kept in step.** The Android app has no server, so the engine and AI are ported to
  TypeScript. `backend/scripts/generate_engine_parity.py` records hundreds of moves from the Python
  engine, and the frontend tests replay them against the TypeScript one. After changing the rules in
  `game_engine.py`, run that script and port the change.
- **Animation.** The engine records each pickup, drop and capture of a move, and the end-of-game
  sweep. The UI plays them back seed by seed, so the server stays the single source of truth for the
  rules on the web.
- **Offline mode.** The `standalone` Vite mode (`.env.standalone` sets `VITE_STANDALONE=true`) swaps
  the API calls for on-device storage and removes the login screens. The normal build still uses the
  server.

---

## How this project was made

It was generated and iterated with [Claude Code](https://claude.com/claude-code), starting from a
blueprint-driven template. The scaffolding is still in the repository:

| Path | Purpose |
|---|---|
| `INITIAL.md`, `Product Description.txt` | The original product definition |
| `PRPs/pallankuzhi-prp.md` | The implementation blueprint (its capture-rule text is outdated; the code is authoritative) |
| `CLAUDE.md` | Project rules and conventions for Claude Code |
| `agents/`, `skills/`, `.claude/commands/` | Agent roles, code patterns and the `/generate-prp` and `/execute-prp` commands |
