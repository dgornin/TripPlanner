# Travel Buddy RU

AI trip planner for Russia. Speak or type to an LLM agent, get a multi-day plan with pins on a
map, refine by chat or Telegram, share the result. Built on Anthropic Claude Haiku 4.5 with a
RAG layer over curated Russian-travel content.

## Quick start

```bash
cp .env.example .env          # fill in ANTHROPIC_API_KEY (and optionally TELEGRAM_BOT_TOKEN)
make install                  # installs backend (venv) + frontend (npm) deps
make up                       # starts Postgres + backend + bot + frontend via podman/docker
open http://localhost:5173
```

Or run locally against a dev Postgres:

```bash
make up-postgres              # compose only brings up pgvector postgres
make migrate                  # apply schema
make backend-dev              # uvicorn on :8000
make frontend-dev             # vite on :5173
```

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind + React-Leaflet + React-Query + Zustand + framer-motion + recharts
- **Backend:** FastAPI + SQLAlchemy (async) + Pydantic v2 + Alembic + sse-starlette
- **DB:** PostgreSQL 16 with `pgvector` extension
- **LLM:** Anthropic Claude Haiku 4.5 with tool use + prompt caching
- **RAG:** sentence-transformers (multilingual MiniLM) + pgvector
- **Maps:** OpenStreetMap via Leaflet; geocoding via Nominatim
- **STT:** Browser Web Speech API (primary) + faster-whisper fallback (backend)
- **Telegram:** python-telegram-bot

## Docs

- Design spec: [`docs/superpowers/specs/2026-04-18-travel-buddy-ru-design.md`](docs/superpowers/specs/2026-04-18-travel-buddy-ru-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-04-18-travel-buddy-ru.md`](docs/superpowers/plans/2026-04-18-travel-buddy-ru.md)
