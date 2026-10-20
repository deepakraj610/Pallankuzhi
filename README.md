# Pallankuzhi

A single-player game of **Pallankuzhi**, the traditional Tamil mancala. Play against an AI opponent
(Easy or Medium) on a carved-wood board with tamarind seeds, with seed-by-seed sowing animation.

## Android app

The Android app is fully **offline**: the game runs on your phone, with no server and no login.
Games and stats are saved on the device.

**[Download the Android app (Pallankuzhi-1.0-release.apk)](https://github.com/deepakraj610/Pallankuzhi/releases/download/v1.0.0/Pallankuzhi-1.0-release.apk)**
· [All releases](https://github.com/deepakraj610/Pallankuzhi/releases)

To install:

1. Download the APK onto your Android phone (Android 5.1 or newer).
2. Open it and allow "install unknown apps" for the app you opened it from, if asked.

If you have an earlier test build installed, uninstall it first, as it was signed with a different key.
To build the app yourself, see [frontend/ANDROID.md](frontend/ANDROID.md).

---

# MicroSaaS Template

> The web version of this project (FastAPI + React) was generated from the template below.
> **Clone. Define. Build.** Full-stack SaaS in minutes.

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/manojkanur/MicroSaaS-Template-Private.git my-saas
cd my-saas

# 2. Define your product
# Edit INITIAL.md with your product details

# 3. Generate blueprint
/generate-prp INITIAL.md

# 4. Build with parallel agents
/execute-prp PRPs/[name]-prp.md
```

---

## What You Get

- FastAPI backend with JWT + Google OAuth
- React frontend with modern UI (Framer Motion)
- PostgreSQL database with migrations
- Docker + CI/CD ready
- 80%+ test coverage

---

## How It Works

```
INITIAL.md → /generate-prp → PRP blueprint → /execute-prp → Full App

Phase 1 (Parallel):
├─ DATABASE-AGENT  → Models + migrations
├─ BACKEND-AGENT   → API structure
├─ FRONTEND-AGENT  → React setup
└─ DEVOPS-AGENT    → Docker + CI

Phase 2 (Per Module):
├─ Backend endpoints
└─ Frontend pages

Phase 3 (Parallel):
├─ TEST-AGENT      → 80%+ coverage
└─ REVIEW-AGENT    → Security audit
```

---

## Files

| File | Purpose |
|------|---------|
| `INITIAL.md` | Define your product |
| `CLAUDE.md` | Project rules |
| `skills/*.md` | Code patterns (5 files) |
| `agents/*.md` | Agent definitions |
| `.claude/commands/` | Custom commands |

---

## Skills (5 files)

| Skill | Contains |
|-------|----------|
| `BACKEND.md` | FastAPI + JWT + OAuth + Errors |
| `FRONTEND.md` | React + UI Kit + API integration |
| `DATABASE.md` | SQLAlchemy + Alembic |
| `TESTING.md` | pytest + Vitest |
| `DEPLOYMENT.md` | Docker + GitHub Actions |

---

## Commands

| Command | Description |
|---------|-------------|
| `/setup-project` | Interactive wizard |
| `/generate-prp` | Create implementation blueprint |
| `/execute-prp` | Build with parallel agents |

---

## Tech Stack

- **Backend:** FastAPI + Python 3.11+
- **Frontend:** React + TypeScript + Vite
- **Database:** PostgreSQL + SQLAlchemy
- **Auth:** JWT + Google OAuth
- **UI:** Chakra UI or Tailwind + Framer Motion
- **Deploy:** Docker + GitHub Actions

---

## Example

```bash
# Define an invoice SaaS in INITIAL.md:
# - Module: Invoices (CRUD)
# - Module: Clients (CRUD)
# - Module: Dashboard

/generate-prp INITIAL.md
# Creates PRPs/invoice-saas-prp.md

/execute-prp PRPs/invoice-saas-prp.md
# 4 agents build in parallel
# ~20-30 minutes for complete app
```

---

## Output Structure

```
my-saas/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── routers/
│   │   ├── services/
│   │   └── auth/
│   ├── alembic/
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── services/
├── docker-compose.yml
└── .github/workflows/
```

---

## Run Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev

# Docker
docker-compose up -d
```
