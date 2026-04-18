# Travel Buddy RU

AI trip planner for Russia. Speak or type to an LLM agent, get a multi-day plan
with pins on a map, refine by chat or Telegram, share the result.

Built in a single Claude Code session (vibe-coding).

## Feature matrix (course rubric, 12/12)

| # | Criterion | Where |
|---|---|---|
| 1 | Solves an applied task | Trip-planning across Russia with map routing |
| 2 | Vibe-coded | End-to-end in a Claude Code session; design via `frontend-design` skill |
| 3 | Uses an LLM | Anthropic Claude **Haiku 4.5** via LangChain + LangGraph ReAct agent |
| 4 | Telegram bot | `python-telegram-bot` worker with `/start`, `/link`, `/new_trip`, `/trips` |
| 5 | Landing page | `/` — hero, features, CTA, marquee, footer |
| 6 | Web UI | React 18 + Vite + TypeScript + Tailwind SPA |
| 7 | Authentication | Email + password, bcrypt, JWT in HttpOnly cookie |
| 8 | RAG assistant | `pgvector` + `sentence-transformers` multilingual MiniLM + curated RU corpus |
| 9 | Database | Postgres 16 with pgvector extension |
| 10 | Voice input (STT) | Web Speech API (`ru-RU`) in the composer + faster-whisper fallback |
| 11 | Usage stats dashboard | `/app/admin` — KPI cards, line chart, top-destinations |
| 12 | Funnel analytics | events pipeline + `/app/admin` funnel: page_view → signup → trip_created → message_sent → trip_shared |

## Screens

- `/` landing — editorial travel-atlas aesthetic, animated SVG route hero
- `/signup`, `/login` — boarding-pass ticket-stub as split hero
- `/app/trips` — trip list + new-trip form (destination, dates, interests)
- `/app/trips/:id` — map-primary layout, glass itinerary card, floating chat composer, day chips with keyboard shortcuts 1–9
- `/app/admin` — KPI, stats chart, funnel (admin-only)
- `/app/settings/telegram` — link-code issuance + deep-link
- `/share/trips/:id` — public read-only share view

## Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind v3, React-Router, `@tanstack/react-query`, `zustand`, `react-leaflet`, `framer-motion`, `recharts`, `lucide-react`
- **Backend:** FastAPI, SQLAlchemy (async, asyncpg), Pydantic v2, Alembic, sse-starlette
- **Database:** PostgreSQL 16 with `pgvector` extension
- **LLM:** Anthropic Claude Haiku 4.5 via `langchain-anthropic` + `langgraph.create_agent` (ReAct loop)
- **Tools:** `@tool`-decorated async functions; session-per-tool for safe parallel tool calls; per-trip `asyncio.Lock` to serialize `order_index` writes
- **RAG:** `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` → `Vector(384)` in pgvector; cosine distance retrieval
- **Maps:** Leaflet + OpenStreetMap tiles; Nominatim geocoding
- **STT:** browser Web Speech API primary; `faster-whisper` fallback behind `/api/stt`
- **Telegram:** `python-telegram-bot` long-polling worker, shares DB with web backend
- **Auth:** bcrypt hashing; JWT in HttpOnly `access_token` cookie

## Architecture

```
┌──────────────┐      ┌────────────────────┐     ┌────────────────┐
│ React SPA    │◀────▶│ FastAPI            │◀───▶│ Postgres 16    │
│ (Vite 5173)  │ SSE  │ - /api/auth        │     │ + pgvector     │
│              │      │ - /api/trips       │     │                │
│              │      │ - /api/messages    │     │                │
│              │      │ - /api/events      │     │                │
│              │      │ - /api/admin       │     │                │
│              │      │ - /api/stt         │     │                │
│              │      │ - /api/telegram    │     │                │
│              │      └──────────┬─────────┘     └────────────────┘
│              │                 │                        ▲
│              │                 ▼                        │
│              │         ┌──────────────┐                 │
│              │         │ LangGraph    │                 │
│              │         │ ReAct agent  │                 │
│              │         │ Haiku 4.5    │                 │
│              │         └──────┬───────┘                 │
│              │                │ tools:                  │
│              │                │ kb_search/search_place/ │
│              │                │ add_place/remove/update │
│              │                │ set_day_title/summary   │
│              │                └─────────────────────────┘
└──────────────┘
                         ┌────────────────────┐
                         │ Telegram bot       │◀─── shares DB
                         │ (long poll)        │
                         └────────────────────┘
```

## Quick start (local dev)

```bash
# 1. Environment
cp .env.example .env
# fill in ANTHROPIC_API_KEY (and optionally TELEGRAM_BOT_TOKEN)

# 2. Dependencies
make install                 # python3.11 venv + npm install

# 3. Bring up Postgres with pgvector (via podman/docker)
podman run -d --name tb-postgres \
  -e POSTGRES_USER=travelbuddy \
  -e POSTGRES_PASSWORD=travelbuddy \
  -e POSTGRES_DB=travelbuddy \
  -p 5433:5432 \
  pgvector/pgvector:pg16

# 4. Migrate + seed RAG corpus
make migrate                 # alembic upgrade head

# 5. Start services (three terminals, or use docker compose)
make backend-dev             # uvicorn on :8000
make frontend-dev            # vite on :5173
make bot-dev                 # telegram long-polling (optional)
```

Open http://localhost:5173, sign up, describe a trip.

### Demo credentials

Pre-seeded accounts used during E2E testing:

| Email | Password | Role |
|---|---|---|
| **`admin@travelbuddy.ru`** | **`admin1234`** | **Admin** — sees `/app/admin` analytics dashboard |
| `chrome@local.ru` | `secret1` | Admin (backup) |
| `demo@local.ru` | `secret1` | Regular user |

> Easiest way to get a clean admin for a demo:
> ```bash
> make backend-dev-seed-admin   # (or re-run the one-liner below)
> ```
>
> ```bash
> cd backend && .venv/bin/python -c "
> import asyncio; from sqlalchemy import select
> from app.db.session import SessionLocal; from app.db.models import User
> from app.core.security import hash_password
> async def main():
>   async with SessionLocal() as db:
>     u = (await db.execute(select(User).where(User.email=='admin@travelbuddy.ru'))).scalar_one_or_none()
>     if u:
>       u.password_hash = hash_password('admin1234'); u.is_admin = True
>     else:
>       db.add(User(email='admin@travelbuddy.ru', password_hash=hash_password('admin1234'), is_admin=True, display_name='Admin'))
>     await db.commit()
> asyncio.run(main())"
> ```
>
> Or just `POST /api/auth/signup` for a fresh regular account.

### Full-stack via compose (podman or docker)

```bash
make up
```

This brings up postgres, backend (runs migrations), bot, and the production
nginx-served frontend build.

## Tests

- Backend: **17 pytest** tests (auth / events / trips CRUD / geocoding / RAG retrieval / agent tool-loop / admin / telegram link)
  ```bash
  make test   # runs backend + frontend
  ```
- Throwaway test DB per session (conftest creates and drops it with pgvector enabled).

## Notable implementation details

- **Agent**: `langchain.agents.create_agent` with a list of `@tool` functions. Each tool opens its own `AsyncSession`, so the agent's parallel tool-calls don't collide on a shared session. `add_place` also acquires a per-trip `asyncio.Lock` to avoid `order_index` races.
- **Streaming**: SSE via `sse-starlette`, events `token | tool_call | tool_result | state | done | error`. Frontend parses via a small `streamPostSse` helper over `fetch()` (native EventSource can't POST).
- **Stacking context**: Leaflet creates internal panes with z-index 200–700 that otherwise escape their parent. `.leaflet-container { isolation: isolate }` contains them so our overlays (z-20 / z-30) render correctly on top.
- **Corp TLS**: `SSL_CERT_FILE` honored for Anthropic HTTPS — combine with Yandex root CA for MITM'd networks. Escape hatch `ANTHROPIC_DISABLE_TLS_VERIFY=true` for emergencies.

## Docs

- Design spec: [`docs/superpowers/specs/2026-04-18-travel-buddy-ru-design.md`](docs/superpowers/specs/2026-04-18-travel-buddy-ru-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-04-18-travel-buddy-ru.md`](docs/superpowers/plans/2026-04-18-travel-buddy-ru.md)
