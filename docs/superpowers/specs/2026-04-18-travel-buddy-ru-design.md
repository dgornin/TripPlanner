# Travel Buddy RU — Design Spec

**Date:** 2026-04-18
**Author:** Claude (under direction of Daniil Gornin)
**Status:** Draft → covers all 12 course rubric criteria

## 1. Product Vision

Travel Buddy RU is a web application that lets a Russian-speaking traveler plan a multi-day trip across Russia by talking (or typing) to an AI agent. The agent suggests places to visit, clusters them by day, places pins on a map, and lets the user toggle between days. The user can refine the plan by chat or voice, then export or share the result. The same AI agent is also available through a Telegram bot.

The product combines an AI planner, a retrieval-augmented knowledge base about Russian travel, a Telegram companion, and an analytics dashboard so the product owner can see how users move through the funnel.

## 2. Evaluation rubric coverage (12 pts)

| # | Criterion | Implementation |
|---|---|---|
| 1 | Solves an applied task | Trip planning across Russia with map routing. |
| 2 | Built via vibe-coding | Built in this Claude-Code session. |
| 3 | Uses an LLM | Anthropic Claude Haiku 4.5 agentic loop with tool use. |
| 4 | Telegram bot integration | `python-telegram-bot` bot that talks to the same agent; account linking via deep-link token. |
| 5 | Landing page | Marketing `/` with hero, features, demo mock, CTA to sign up. |
| 6 | Web UI | React SPA at `/app/*` for authed users. |
| 7 | Authentication | Email + password, JWT in `HttpOnly` cookie, password hashed with bcrypt. |
| 8 | RAG assistant | pgvector + multilingual embeddings + curated Russian-travel corpus; agent tool `kb_search`. |
| 9 | Database | PostgreSQL 16 with pgvector extension. |
| 10 | Voice input (STT) | Browser Web Speech API (`ru-RU`) + a backend Whisper-based fallback endpoint. |
| 11 | Usage stats dashboard | `/app/admin` protected page with charts: signups, trips, messages, destinations. |
| 12 | Funnel analytics | Event pipeline (`events` table) + funnel view `landing_visit → signup → trip_created → message_sent → trip_shared`. |

## 3. Scope

### In scope (MVP, mapped to rubric)
- Marketing landing page with hero/features/CTA (crit. 5).
- Email + password signup & login, JWT cookie auth, "/app" guarded by auth (crit. 7).
- Anonymous telemetry for the landing funnel (crit. 12).
- App shell with:
  - New-trip form (destination, dates, travelers, interests).
  - Trip page: chat panel, itinerary panel, map panel, day selector.
  - Voice-input button in the chat composer (crit. 10).
  - "Share trip" read-only link.
- LLM agent (Haiku 4.5) with tool use including `kb_search` over pgvector (crits. 3, 8).
- RAG corpus: ~100–200 curated Russian-travel snippets ingested at first boot (crit. 8).
- Telegram bot with `/start`, `/link`, `/new_trip`, `/trips`, free-text conversation routed to the same agent (crit. 4).
- Admin dashboard `/app/admin` with KPI cards + line charts + funnel (crits. 11, 12).
- Event tracking middleware + client SDK emitting `page_view`, `signup`, `trip_created`, `message_sent`, `trip_shared`.

### Out of scope (MVP)
- OAuth / third-party logins.
- Payments, bookings, real-time availability.
- Mobile apps (responsive web only).
- TSP route optimization.
- Yandex Maps (uses OSM/Leaflet; easy to swap later).

### Stretch goals
- Drag-and-drop reordering of places.
- Travel-time estimation (OSRM public API).
- Trip cover imagery.

## 4. Architecture

### Top-level layout
```
TripPlanner/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI routers: auth, trips, messages, admin, events, bot
│   │   ├── agent/            # System prompt, tool schema, Anthropic client, runner
│   │   ├── bot/              # Telegram bot wiring (long-poll worker)
│   │   ├── db/               # SQLAlchemy models + session + pgvector setup
│   │   ├── rag/              # Embedder, retriever, corpus loader
│   │   ├── schemas/          # Pydantic DTOs
│   │   ├── services/         # geocoding, stt, events, trip
│   │   ├── core/             # config, security (jwt, hashing)
│   │   └── main.py
│   ├── alembic/
│   ├── data/                 # Seed RAG corpus as JSONL
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/            # Landing, Login, Signup, NewTrip, Trip, Admin
│   │   ├── components/       # Map, Chat, Itinerary, DaySelector, VoiceButton, ...
│   │   ├── api/              # Typed client
│   │   ├── store/            # Zustand
│   │   ├── lib/              # analytics.ts, speech.ts
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docker-compose.yml        # Podman-compatible (plain compose v3 syntax)
├── Makefile
├── .env.example
└── docs/superpowers/{specs,plans}/
```

### Services (compose)
- `postgres` (image `pgvector/pgvector:pg16`) — DB + embeddings.
- `backend` — FastAPI on `:8000`.
- `bot` — same backend image, different entrypoint (`python -m app.bot.main`).
- `frontend` — Vite dev server or nginx-served production build on `:5173` / `:80`.
- Network: shared bridge; backend talks to postgres; bot talks to backend HTTP or DB directly via shared models.

### Request flow (create a trip)
1. User signs up → backend writes `users` row, sets JWT cookie, emits `signup` event.
2. User submits new-trip form → `POST /api/trips` → trip row created; event `trip_created`.
3. Frontend opens `/app/trips/:id`, starts SSE stream on `POST /api/trips/:id/messages`.
4. Agent iterates: `kb_search` → `search_place` (Nominatim) → `add_place` → ...; emits state patches.
5. Each `message_sent` is logged as an event.
6. User clicks "Share" → public read-only page (no auth) — event `trip_shared`.

### RAG flow
- Seed corpus stored in `backend/data/kb_russia.jsonl` (title, content, url, city tags).
- On startup, if `kb_chunks` is empty, the loader embeds and inserts chunks.
- Embeddings: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384 dims, supports Russian, CPU-friendly).
- Retrieval: `SELECT ... ORDER BY embedding <=> query_emb LIMIT 5`.
- The agent tool `kb_search(query)` returns top-k passages with source URL.

### Telegram bot flow
- Bot runs as a separate process (long polling) sharing backend models/DB.
- Login via `/link <code>` — code is issued in the web UI (page `/app/settings/telegram`).
- After link, bot messages are posted to the same agent runner (`handle_user_message`) under the user's account and they appear in the web-UI trip list.
- `/new_trip` asks for destination + dates in a short dialog, then opens an agent session.

### Voice input
- Primary: browser Web Speech API (`SpeechRecognition`) with `lang="ru-RU"`. Zero backend dependency.
- Fallback: `POST /api/stt` accepts 16kHz WAV/webm and returns transcript using `faster-whisper` small model, loaded lazily.

### Analytics
- Middleware logs `events(user_id, session_id, type, props JSONB, ts)`.
- Client SDK (`frontend/src/lib/analytics.ts`) calls `POST /api/events` for page views and UI actions.
- Dashboard SQL views: daily-active, signups, trips-per-day, funnel conversion, top destinations.

## 5. Data model

```sql
-- Users + auth
users (
  id UUID PK,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  telegram_user_id BIGINT,         -- linked after /link code
  telegram_link_code TEXT,
  created_at TIMESTAMPTZ
)

-- Trip / Day / Place — same as v1, but trips.user_id (nullable for shared-anon legacy)
trips (
  id UUID PK,
  user_id UUID FK users,
  title TEXT,
  destination TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  travelers INT DEFAULT 1,
  interests TEXT[] DEFAULT '{}',
  summary TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

days (id, trip_id FK, day_number, date, title)
places (id, day_id FK, order_index, name, description, category, lat, lon, address, duration_minutes)
messages (id, trip_id FK, role, content JSONB, created_at)

-- RAG
kb_chunks (
  id UUID PK,
  source_title TEXT,
  source_url TEXT,
  city TEXT,
  content TEXT NOT NULL,
  embedding vector(384) NOT NULL
)
CREATE INDEX ON kb_chunks USING ivfflat (embedding vector_cosine_ops);

-- Analytics
events (
  id BIGSERIAL PK,
  user_id UUID FK users,
  session_id TEXT,
  type TEXT NOT NULL,              -- 'page_view' | 'signup' | 'trip_created' | ...
  props JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ
)
CREATE INDEX events_type_ts ON events(type, created_at);
CREATE INDEX events_user ON events(user_id);
```

## 6. API surface

`/api` prefix. JSON. Auth via `access_token` HttpOnly cookie. Open endpoints: landing analytics + auth + public-trip.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | no | Create account, set cookie. |
| POST | `/auth/login` | no | Login, set cookie. |
| POST | `/auth/logout` | yes | Clear cookie. |
| GET | `/auth/me` | yes | Current user. |
| POST | `/trips` | yes | Create trip. |
| GET | `/trips` | yes | List my trips. |
| GET | `/trips/:id` | yes (or public) | Full trip. |
| DELETE | `/trips/:id` | yes | Delete. |
| PATCH | `/trips/:id` | yes | Metadata / `is_public`. |
| POST | `/trips/:id/messages` | yes | Streams agent response (SSE). |
| DELETE | `/places/:id` | yes | Remove place. |
| GET | `/public/trips/:id` | no | Read-only for shared trips. |
| POST | `/stt` | yes | Whisper fallback transcribe. |
| POST | `/events` | no | Log analytics event (captures landing visits). |
| GET | `/admin/stats` | admin | Aggregated KPIs. |
| GET | `/admin/funnel` | admin | Funnel counts. |
| POST | `/telegram/link` | yes | Issue linking code. |
| POST | `/telegram/webhook` | — | (Optional; long-poll is default.) |

## 7. LLM agent

- Model: `claude-haiku-4-5-20251001`.
- Prompt caching on static system prompt + tool schema.
- Max 12 agent turns per user message.
- System prompt: Russian; agent is "Travel Buddy", refers to pgvector KB for facts, must call `search_place` before `add_place`, must prefer knowledge from `kb_search` over guessing.

### Tools
```
kb_search(query: str, city: str | None) -> [{title, url, snippet}]
search_place(query: str, near_city: str) -> [{name, lat, lon, address, category}]
add_place(day_number, name, description, lat, lon, duration_minutes, category, address) -> {place_id, order_index}
update_place(place_id, fields: dict) -> {ok}
remove_place(place_id) -> {ok}
reorder_places(day_number, place_ids_in_order: list[str]) -> {ok}
set_day_title(day_number, title) -> {ok}
set_trip_summary(summary) -> {ok}
```

## 8. Frontend

### Routes
- `/` — landing (public).
- `/login`, `/signup` — auth.
- `/app` — redirect to `/app/trips`.
- `/app/trips` — my trips list + new-trip form.
- `/app/trips/:id` — trip page (chat / itinerary / map).
- `/app/admin` — admin dashboard (only `is_admin` users).
- `/app/settings/telegram` — linking UI.
- `/share/trips/:id` — public read-only view.

### Visual direction
Produced via `frontend-design` skill. Each visual surface gets one skill invocation with explicit context: Russian travel, warm-and-modern, hero-mapped landing. We avoid the generic two-pane AI chat layout for the trip page — the map is the hero.

### State
- `@tanstack/react-query` for server data (trips, user, admin stats).
- `zustand` for UI state (selected day, chat composer, map focus).
- `react-leaflet` for map.
- `framer-motion` for day-toggle transitions.
- `recharts` for dashboard charts.

### Voice input component
`<VoiceButton onTranscript={fn}/>` uses Web Speech API with `lang="ru-RU"`; if unavailable, falls back to record-then-upload to `/api/stt`.

## 9. Telegram bot

- Library: `python-telegram-bot==21.*`.
- Runs as a separate container process `bot` sharing the DB.
- Commands: `/start`, `/help`, `/link <code>`, `/new_trip`, `/trips`, plain text → agent.
- Link flow: web UI issues a 6-char code (stored in `users.telegram_link_code`), user sends `/link ABC123` in Telegram; bot matches the code and sets `telegram_user_id`.
- Conversational planning: user's free-text messages create or continue a trip; the reply streams tool outcomes as short status messages.

## 10. DevX & deployment

### Makefile
```
make install          # pip install backend + npm install frontend
make up               # compose up -d
make down             # compose down
make dev              # compose up postgres; run backend + frontend + bot locally
make backend-dev
make frontend-dev
make bot-dev
make migrate          # alembic upgrade head
make seed-rag         # embed & insert kb corpus
make test             # pytest + vitest
make lint             # ruff + eslint
make fmt              # ruff format + prettier
```

### Compose (Podman-compatible)
- Plain v3 syntax; no BuildKit-only directives.
- Services: `postgres` (pgvector), `backend`, `bot`, `frontend`.
- Healthcheck `pg_isready` on postgres; `depends_on` for backend/bot.
- Volume `pgdata:/var/lib/postgresql/data`.

### Environment
`.env.example` committed; real `.env` holds:
- `ANTHROPIC_API_KEY`
- `DATABASE_URL`
- `JWT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `CORS_ORIGINS`
- `STT_MODEL=small`

## 11. Testing

- **Backend**: pytest + `pytest-asyncio` + `httpx.AsyncClient` against a throwaway test DB. Cover auth, CRUD, agent (Anthropic mocked), RAG retrieval, events, admin stats.
- **RAG seed**: smoke test that after seeding, `kb_search("Казань кремль")` returns at least one chunk whose content contains "Казань".
- **Bot**: unit-tests on command handlers using `python-telegram-bot`'s test harness.
- **Frontend**: Vitest for `analytics.ts`, `speech.ts`, day-toggle logic.
- **Manual UI verification** with `mcp__Claude_in_Chrome__*` on: landing render → signup → new trip → chat arrives → day toggle → admin dashboard renders.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Whisper model heavy in container | Lazy-load, or skip if `USE_WHISPER=false`; voice primarily via browser. |
| Embedding model download on first run | Pre-download in Dockerfile; cache to volume. |
| pgvector extension missing | Use `pgvector/pgvector:pg16` image. |
| Telegram long-polling + web process race | Separate process; both share DB, not in-memory state. |
| Nominatim rate limits | Per-trip cache in DB. |
| Agent token cost | Cap tool calls at 12, prompt caching. |

## 13. Success criteria

- `make up` brings up the whole stack with only `.env` filled in.
- A visitor can: see landing page → sign up → submit "Казань, 3 дня, культура + еда" → within ~30 s see 10–15 pinned places on a map with day toggles → use the 🎙 voice button in Russian → share the trip → the bot with `/start` + `/link` keeps planning → admin sees counts and funnel update.
- Every rubric criterion (1–12) maps to an implemented, reachable feature.
