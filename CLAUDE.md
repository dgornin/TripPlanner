# Travel Buddy RU — Claude Code project notes

Context for future Claude sessions working on this repo. Keep this file
**current** — if you change architecture, update this.

## Elevator pitch

AI trip planner for Russia. User signs in on a modern landing, fills a 4-field
form (city / dates / interests / optional hotel), and a Haiku 4.5 agent (LangChain
+ LangGraph, real tool calling) automatically generates a day-by-day plan with
3–4 places per day, pinned on a Leaflet map. User refines by chat or voice, or
continues the conversation in the Telegram bot `@ai_trevel_agent_bot`. Shareable
read-only URL. Admin dashboard with KPIs + 5-step funnel.

Built entirely in Claude Code sessions (vibe-coding), per the course rubric.

## Rubric coverage (12/12)

1. Applied task — trip planning + routing
2. Vibe-coded — this whole repo
3. LLM — Anthropic Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
4. Telegram bot — long-polling worker, shares backend agent
5. Landing page — `/`
6. Web UI — React SPA
7. Auth — bcrypt + JWT in HttpOnly cookie
8. RAG — `pgvector` + multilingual MiniLM + curated RU corpus
9. Database — Postgres 16 + pgvector
10. Voice input — Web Speech API (ru-RU) + faster-whisper fallback at `/api/stt`
11. Usage stats dashboard — `/app/admin`
12. Funnel analytics — `events` table + `/api/admin/funnel`

## Stack

**Frontend** (`frontend/`)
- React 18, Vite, TypeScript, Tailwind v3
- react-router-dom, @tanstack/react-query, zustand
- react-leaflet + leaflet, framer-motion, recharts, lucide-react
- No design system library; shared primitives in `src/components/ui/`

**Backend** (`backend/`)
- Python 3.11, FastAPI, uvicorn
- SQLAlchemy 2 async + asyncpg, Alembic
- Pydantic v2 + pydantic-settings
- `langchain`, `langchain-anthropic`, `langchain-core`, `langgraph`
- `anthropic` SDK (indirectly via langchain-anthropic)
- `sentence-transformers` for embeddings
- `python-telegram-bot` 21+ for the bot worker
- `sse-starlette` for agent streaming
- `faster-whisper` for STT fallback (lazy-loaded)
- bcrypt 4.0.1 (pinned — passlib chokes on 4.1+)

**Infra**
- `pgvector/pgvector:pg16` container
- podman-compose compatible (docker syntax)

## Directory layout

```
.
├── backend/
│   ├── app/
│   │   ├── agent/              # LangGraph agent
│   │   │   ├── prompt.py       # SYSTEM_PROMPT (Russian, strict tool-first)
│   │   │   ├── tools.py        # @tool defs + session-per-tool + per-trip lock
│   │   │   └── runner.py       # run_agent(): astream_events -> dict events
│   │   ├── api/                # FastAPI routers
│   │   │   ├── auth.py         # signup/login/logout/me (JWT cookie)
│   │   │   ├── trips.py        # CRUD + public share; geocodes accommodation
│   │   │   ├── messages.py     # SSE endpoint POST /api/trips/:id/messages
│   │   │   ├── events.py       # Analytics ingest
│   │   │   ├── admin.py        # /admin/stats + /admin/funnel
│   │   │   ├── stt.py          # /stt (faster-whisper)
│   │   │   ├── telegram.py     # Link-code issuance
│   │   │   └── deps.py         # current_user / admin_user dependencies
│   │   ├── bot/
│   │   │   ├── main.py         # Long-poll worker (python-telegram-bot)
│   │   │   └── handlers.py     # /start, /link, /new_trip, /trips, on_text
│   │   ├── core/
│   │   │   ├── config.py       # Settings (pydantic-settings)
│   │   │   └── security.py     # bcrypt hash + JWT encode/decode
│   │   ├── db/
│   │   │   ├── base.py         # Declarative base
│   │   │   ├── models.py       # User, Trip, Day, Place, Message, KbChunk, Event
│   │   │   └── session.py      # engine, SessionLocal, get_db
│   │   ├── rag/
│   │   │   ├── embedder.py     # sentence-transformers lazy singleton
│   │   │   ├── retriever.py    # search_kb via pgvector cosine
│   │   │   └── seed.py         # Loads data/kb_russia.jsonl on first boot
│   │   ├── schemas/            # Pydantic DTOs
│   │   ├── services/
│   │   │   ├── geocoding.py    # Nominatim async httpx client
│   │   │   └── stt.py          # faster-whisper wrapper
│   │   └── main.py             # create_app(), lifespan, CORS, router mounts
│   ├── alembic/
│   │   └── versions/
│   │       ├── 0001_init.py               # initial schema + pgvector
│   │       └── 0002_accommodation.py      # trips.accommodation + lat/lon
│   ├── data/kb_russia.jsonl    # 40 curated RU travel snippets (10 cities)
│   ├── tests/                  # pytest — 17 green
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                # Typed axios wrappers
│   │   ├── components/
│   │   │   ├── ui/             # Button, Container, Logo
│   │   │   ├── admin/          # KpiCard, StatsChart, Funnel
│   │   │   ├── ChatPanel.tsx   # SSE stream consumer + autoStart dedup
│   │   │   ├── DaySelector.tsx # Chip row with keyboard 1-9 / 0=all
│   │   │   ├── Itinerary.tsx
│   │   │   ├── MapView.tsx     # Leaflet; home marker + day-colored pins
│   │   │   ├── NewTripForm.tsx # 4 fields + interests + accommodation
│   │   │   └── VoiceButton.tsx # Web Speech API wrapper
│   │   ├── hooks/useVoiceInput.ts
│   │   ├── lib/
│   │   │   ├── analytics.ts    # POST /api/events
│   │   │   ├── speech.ts       # SpeechRecognition factory
│   │   │   └── sse.ts          # fetch-based SSE reader (POST → stream)
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx         # Auth-aware hero with map texture
│   │   │   ├── LoginPage.tsx + SignupPage.tsx (+ AuthCard)
│   │   │   ├── AppLayout.tsx           # Sticky nav + mobile drawer
│   │   │   ├── TripsPage.tsx           # List + new-trip form
│   │   │   ├── TripDetailPage.tsx      # Wires map+itinerary+chat; autoStart
│   │   │   ├── TripPage.tsx            # Three-pane shell
│   │   │   ├── AdminPage.tsx           # KPI + chart + funnel
│   │   │   ├── TelegramSettingsPage.tsx
│   │   │   └── PublicTripPage.tsx      # Read-only /share/trips/:id
│   │   ├── store/
│   │   │   ├── authStore.ts    # zustand; load() fetches /auth/me
│   │   │   └── uiStore.ts      # selectedDay + toast
│   │   ├── App.tsx             # Routes + GuestOnly redirect
│   │   └── main.tsx
│   ├── tailwind.config.ts      # brand (orange) + ink (gray-blue) palettes
│   └── Dockerfile              # nginx-served dist
├── docker-compose.yml          # postgres + backend + bot + frontend
├── Makefile                    # install/up/down/dev/migrate/seed-rag/test
├── .env.example
├── docs/superpowers/
│   ├── specs/2026-04-18-travel-buddy-ru-design.md
│   └── plans/2026-04-18-travel-buddy-ru.md
└── CLAUDE.md  (this file)
```

## Key design decisions (read before refactoring)

### Agent — session-per-tool, per-trip lock
`app/agent/tools.py` opens a **fresh** `AsyncSession` inside every `@tool`
function (via module-level `_SessionMaker`). The langgraph-driven agent often
fires several `search_place` / `add_place` tools concurrently; a shared session
deadlocks or races. Also, `add_place` acquires `_mutation_locks[trip_id]` (an
`asyncio.Lock`) before computing `order_index`, otherwise two concurrent
inserts both pick `order_index=1` → unique constraint violation.

**Snapshots for state events use a fresh session too** (`SessionLocal()`
inside the runner) because the shared session passed in from the endpoint has
a cached view that pre-dates the tool commits.

### Agent — context via ContextVar
Tools receive the current `trip_id` via `_ctx_trip_id` ContextVar, set by
`set_agent_context(trip.id)` in the runner. This avoids threading trip/session
through every tool signature and doesn't collide with langchain's tool binding.

### Agent — auto-plan on new trips
`TripDetailPage.buildAutoStart(trip)` assembles a Russian prompt from
destination / dates / interests / accommodation and passes it to
`ChatPanel` as `autoStart`. `ChatPanel` fires it exactly once per
trip using a **module-level `Set<string>`** — `useRef` isn't enough because
React StrictMode double-mounts the component.

### Frontend — stacking context
`.leaflet-container { isolation: isolate }` — Leaflet's internal panes use
z-index 200–700, which otherwise escape into the parent stacking context and
hide our overlays (z-20/z-30). Keep this rule in `src/index.css`.

### Frontend — TripPage height
`h-[calc(100dvh-61px)]` — 61 px is the measured AppLayout sticky header.
TripPage is not meant to scroll; if you change the header height, bump this.

### Backend — corporate TLS MITM
`api.anthropic.com` is intercepted by Yandex's internal CA on this machine.
Two escape hatches in `.env`:
1. **Preferred:** `SSL_CERT_FILE=backend/certs/yandex-ca.pem` — a combined
   bundle of Yandex root CA + certifi. The file is gitignored; re-export with:
   ```bash
   security find-certificate -a -c "YandexInternalRootCA" -p /Library/Keychains/System.keychain > backend/certs/yandex-ca.pem
   security find-certificate -a -c "YandexInternalCA" -p /Library/Keychains/System.keychain >> backend/certs/yandex-ca.pem
   cat "$(.venv/bin/python -c 'import certifi; print(certifi.where())')" >> backend/certs/yandex-ca.pem
   ```
2. **Emergency:** `ANTHROPIC_DISABLE_TLS_VERIFY=true` — NOT for production.

### Backend — Postgres port 5433
The dev Postgres container uses host port **5433**, not 5432, because the
user has a local Homebrew Postgres 14 occupying 5432. `.env.example`
reflects this. If you change it, update `alembic.ini` and `DATABASE_URL`.

### Backend — bcrypt pinned
`bcrypt<4.1` in `pyproject.toml`. passlib's bcrypt backend breaks on 4.1+.

### Backend — event-loop scope in tests
`pyproject.toml` sets:
```
asyncio_default_fixture_loop_scope = "session"
asyncio_default_test_loop_scope = "session"
```
Without this, asyncpg connections leak across loops in pytest-asyncio v1.

## Running locally

```bash
# 1. First time
cp .env.example .env
# Fill in ANTHROPIC_API_KEY (required) and TELEGRAM_BOT_TOKEN (optional)

# 2. Bring up Postgres
podman run -d --name tb-postgres \
  -e POSTGRES_USER=travelbuddy -e POSTGRES_PASSWORD=travelbuddy -e POSTGRES_DB=travelbuddy \
  -p 5433:5432 pgvector/pgvector:pg16

# 3. Install + migrate
make install
make migrate

# 4. Run (separate terminals)
make backend-dev       # uvicorn :8000
make frontend-dev      # vite :5173
make bot-dev           # telegram long-poll (optional)
```

## Demo credentials

| Email | Password | Role |
|---|---|---|
| **admin@travelbuddy.ru** | **admin1234** | **Admin** |
| chrome@local.ru | secret1 | Admin (backup) |
| demo@local.ru | secret1 | Regular user |

See `README.md` for the SQL/Python one-liner to reseed these.

## Known quirks

- **`form_input` MCP tool doesn't trigger React's onChange.** When driving the
  UI via Claude-in-Chrome, set `<input>.value` via the native setter + dispatch
  an `input` event, then call `form.requestSubmit()`. `ChatPanel` ignores empty
  text submits so plain form_input + Enter fails silently.
- **Agent parallel add_place.** Guarded by the per-trip asyncio.Lock; do not
  remove that lock.
- **HuggingFace download on first `kb_search`.** The multilingual MiniLM model
  (~480 MB) lazy-loads on first use from the HF CDN. Make sure Yandex CA is
  installed or downloads will fail with TLS errors similar to Anthropic.
- **Nominatim rate limit.** 1 req/s per official policy. The geocoding
  service uses a custom User-Agent (see Settings). The agent shouldn't hit
  this because placements are sequential, but if you bulk-backfill, space the
  requests.

## How to extend safely

- **New tool** — add a `@tool` function in `app/agent/tools.py`, append it to
  `TOOLS`, open a fresh session inside, commit within. If it mutates places,
  acquire `_lock_for(trip_id)`.
- **New migration** — bump filename to `0003_*.py`, point `down_revision` to
  `"0002"`, add/drop columns in `upgrade()`/`downgrade()`. `make migrate`.
- **New route** — router in `app/api/`, mount in `app/main.py`. If auth-only,
  depend on `current_user`; if admin-only, depend on `admin_user`.
- **New frontend page** — add to `src/pages/`, wire in `App.tsx`. Protected
  routes go inside the `/app` nested route (wrapped in `ProtectedRoute` +
  `AppLayout`). Pages that should redirect logged-in users (login/signup)
  wrap in `GuestOnly`.
- **New analytic event type** — emit `POST /api/events` (frontend via
  `track(type, props)` from `lib/analytics.ts`; backend via direct
  `db.add(Event(...))`). Add to `FUNNEL_STEPS` in `app/api/admin.py` if it
  belongs in the funnel.

## Test discipline

- 17 pytest tests green. Run via `make test`. Fastest iteration:
  `cd backend && set -a && source ../.env && set +a && .venv/bin/pytest tests/test_xxx.py -q`.
- `test_agent.py` monkeypatches `tools._SessionMaker` and
  `app.db.session.SessionLocal` to the test engine. If you add tests that
  exercise the runner, do the same or they'll try to hit the dev DB.

## Related docs

- `README.md` — user-facing quick-start, rubric table, architecture diagram
- `docs/superpowers/specs/2026-04-18-travel-buddy-ru-design.md` — full design
- `docs/superpowers/plans/2026-04-18-travel-buddy-ru.md` — 26-task plan

## Things intentionally NOT done

- Registration email confirmation
- Payment / booking integration
- Server-side i18n (UI is Russian-only; data is Russian-only)
- OAuth (only email+password)
- Route optimization (TSP) — agent groups by semantics, not a solver
- Drag-and-drop reordering of places (stretch goal)
- Service worker / offline mode
