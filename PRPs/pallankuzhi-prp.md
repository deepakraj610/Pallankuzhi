# PRP: Pallankuzhi

> Implementation blueprint for parallel agent execution

---

## METADATA

| Field | Value |
|-------|-------|
| **Product** | Pallankuzhi |
| **Type** | SaaS (single-player web game) |
| **Version** | 1.0 |
| **Created** | 2026-10-20 |
| **Complexity** | Medium |

---

## PRODUCT OVERVIEW

**Description:** A single-player Pallankuzhi (traditional Tamil mancala) game where a signed-in human plays against an AI opponent (Easy = random, Medium = greedy heuristic). Games are stored per user so progress, history and win/loss stats persist.

**Value Proposition:** Keeps a timeless game alive with a clean UI, a competent AI, and saved history/stats across devices.

**MVP Scope:**
- [ ] User registration/login (JWT + Google OAuth)
- [ ] Pure-Python game engine: 14 cups, 5 seeds each, sowing, chain capture, end conditions
- [ ] AI opponent: Easy (random) and Medium (greedy, simulates each move)
- [ ] Playable board UI (2 rows x 7 cups, seed counts, scores, sowing animation)
- [ ] Persisted games and moves; resume in-progress game
- [ ] Dashboard with win/loss/draw stats and game history

**Assumptions / open rule decisions** (flagged because `Product Description.txt` is ambiguous and the INITIAL.md stack differs from its "offline" framing):
- Product is delivered as a web app per INITIAL.md/CLAUDE.md stack; the engine stays a framework-free module so it can also be reused offline/CLI.
- Board indexes 0-6 = human (bottom), 7-13 = AI (top); sowing goes in increasing index order (counter-clockwise), wrapping `% 14`.
- Capture rule (implemented as the spec's first reading): after the last seed lands in cup `L`, if the next cup `(L+1)%14` is non-empty, capture it, then continue to `(L+2)%14`, etc., **chain-capturing while the cups are non-empty and stopping at the first empty cup**; if the cup after `L` is empty, turn ends with no capture. Original cup is left empty; sowing skips no cups.
- The spec's "last seed lands in empty cup -> turn ends" is interpreted as: landing cup empty-before-drop AND next cup empty = no capture. The rule set is isolated in one function (`resolve_capture`) and covered by table-driven tests so it is easy to change.
- Game end: all seeds captured, or the player to move has no seeds on their side. Remaining seeds on the board when a side is empty go to the owner of the side they sit on. Higher captured total wins; equal = draw.
- Server is authoritative: the client sends only a cup index; the server validates, applies the move, runs the AI reply, and returns the new state.

---

## TECH STACK

| Layer | Technology | Skill Reference |
|-------|------------|-----------------|
| Backend | FastAPI + Python 3.11+ | skills/BACKEND.md |
| Frontend | React + TypeScript + Vite | skills/FRONTEND.md |
| Database | PostgreSQL + SQLAlchemy + Alembic | skills/DATABASE.md |
| Auth | JWT + bcrypt + Google OAuth | skills/BACKEND.md |
| UI | Chakra UI + Framer Motion | skills/FRONTEND.md |
| Payments | None | - |
| Testing | pytest + React Testing Library | skills/TESTING.md |
| Deployment | Docker + GitHub Actions | skills/DEPLOYMENT.md |

---

## DATABASE MODELS

### User
- id, email (unique), hashed_password (nullable for OAuth), full_name, is_active, is_verified, oauth_provider, created_at

### RefreshToken
- id, user_id (FK), token_hash, expires_at, revoked, created_at

### Game
- id, user_id (FK), difficulty (easy | medium), board (JSON, 14 ints), human_score, ai_score, current_player (human | ai), status (in_progress | human_won | ai_won | draw | abandoned), created_at, updated_at, finished_at
- Relationship: Game 1—N Move

### Move
- id, game_id (FK), move_number, player (human | ai), cup_index, seeds_sown, seeds_captured, board_after (JSON), created_at

Indexes: `Game(user_id, status)`, `Move(game_id, move_number)` unique.

---

## MODULES

### Module 1: Authentication
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Get access + refresh tokens |
| POST | /auth/refresh | Rotate refresh token |
| GET | /auth/me | Current user |
| GET | /auth/google | Google OAuth login/callback |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /login | LoginPage | LoginForm, GoogleButton |
| /register | RegisterPage | RegisterForm |
| /profile | ProfilePage | ProfileCard |

---

### Module 2: Game Engine & AI (no web dependencies)
**Agents:** BACKEND-AGENT (+ TEST-AGENT in parallel from spec)

**Files:** `backend/app/services/game_engine.py` (`new_board`, `valid_moves`, `sow_seeds`, `resolve_capture`, `apply_move`, `is_game_over`, `final_result`), `backend/app/services/ai_opponent.py` (`choose_move(board, difficulty)`; Easy = `random.choice`, Medium = simulate each move, maximize immediate capture, tiebreak on lowest opponent best reply). Pure functions, type-hinted, no I/O; engine never mutates its input.

Invariant tested everywhere: total seeds on board + both scores == 70.

---

### Module 3: Games API
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/games | List user's games (paginated, filter by status) |
| POST | /api/games | Start new game `{difficulty}` |
| GET | /api/games/{id} | Game state + move history |
| POST | /api/games/{id}/moves | Human move `{cup_index}`; response includes human result and AI reply |
| DELETE | /api/games/{id} | Abandon game |

Errors: 400 invalid cup (empty / opponent side), 409 game not in progress, 404 not owner/not found.

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /games/new | NewGamePage | DifficultyPicker |
| /games/:id | GamePage | Board, Cup, ScorePanel, MoveLog, GameOverModal |
| /games | HistoryPage | GameTable |

---

### Module 4: Dashboard & Stats
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/stats | Wins/losses/draws by difficulty, avg captured, current streak |
| GET | /health | Health check |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /dashboard | DashboardPage | StatCards, ResumeGameCard, RecentGames |

---

## PHASE EXECUTION PLAN

**Phase 1: Foundation (4 agents in parallel)**
- DATABASE-AGENT: User, RefreshToken, Game, Move models; initial Alembic migration; database.py
- BACKEND-AGENT: main.py, config.py, project structure, `game_engine.py` + `ai_opponent.py` (pure logic)
- FRONTEND-AGENT: Vite + TS setup, Chakra theme, folder structure, API client, AuthContext, `types/` mirroring schemas
- DEVOPS-AGENT: Dockerfiles, docker-compose (api, web, postgres), CI workflow, `.env.example`

**Validation Gate 1:** `pip install`, `alembic upgrade head`, `npm install`, `docker-compose config`

**Phase 2: Modules (backend + frontend parallel per module)**
- Auth: JWT/refresh/Google endpoints + Login/Register/Profile pages
- Games: games router + service (server-authoritative moves, AI reply) + Board/GamePage/HistoryPage
- Dashboard: stats endpoint + DashboardPage

**Validation Gate 2:** `ruff check backend/`, `mypy backend/app`, `npm run lint`, `npm run type-check`

**Phase 3: Quality (3 agents in parallel)**
- TEST-AGENT: engine table-driven tests (sowing wrap, chain capture, no-capture, end-game sweep, seed-conservation property test), AI tests, API tests, RTL tests; 80%+ coverage
- REVIEW-AGENT: security audit (ownership checks on every game route, token handling, no secrets), performance review
- RESEARCH-AGENT: validate Pallankuzhi rule variants against the assumptions above; report any needed rule changes

**Final Validation:** full test suite, docker build, health check

---

## VALIDATION GATES

| Gate | Commands |
|------|----------|
| 1 | `alembic upgrade head`, `npm install`, `docker-compose config` |
| 2 | `ruff check backend/`, `mypy backend/app`, `npm run type-check` |
| 3 | `pytest --cov --cov-fail-under=80`, `npm test` |
| Final | `docker-compose up -d`, `curl localhost:8000/health` |

---

## ACCEPTANCE CRITERIA

- [ ] Users can register, login (password + Google) and refresh sessions
- [ ] Users can start a game (Easy/Medium), play to completion, resume, and abandon
- [ ] Engine conserves 70 seeds in every state; illegal moves rejected server-side
- [ ] Medium AI beats Easy AI in a clear majority of simulated games
- [ ] Dashboard shows accurate stats and history
- [ ] 80%+ test coverage
- [ ] Docker builds successfully

---

## ENVIRONMENT VARIABLES

```env
DATABASE_URL=postgresql://user:password@localhost:5432/pallankuzhi
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
VITE_API_URL=http://localhost:8000
```

---

## NEXT STEP

Execute with parallel agents:
/execute-prp PRPs/pallankuzhi-prp.md
