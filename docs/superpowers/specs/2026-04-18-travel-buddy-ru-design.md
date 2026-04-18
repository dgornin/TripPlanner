# Travel Buddy RU — Design Spec

**Date:** 2026-04-18
**Author:** Claude (under direction of Daniil Gornin)
**Status:** Draft → awaiting implementation plan

## 1. Product Vision

Travel Buddy RU is a web application that lets a user plan a multi-day trip across Russia through conversation with an AI agent. The agent suggests places to visit, clusters them by day, places pins on a map, and lets the user toggle between days to see only that day's route. The user can refine the plan via chat ("remove museum X", "add more food on day 2", "shift everything an hour earlier") and re-visualize the result instantly.

The MVP target user is a Russian-speaking traveler planning a 2–7 day city trip. Login is not required — trips are persisted against an anonymous browser session and reachable by URL.

## 2. Scope

### In scope (MVP)
- Anonymous session storage of trips (no registration).
- Home page: a form with destination city, start/end dates, traveler count, interests (checkboxes: culture / food / nature / active / nightlife / family).
- Trip page with three synchronized panes:
  - **Chat pane** — user talks to the AI agent; agent streams responses and emits structured actions.
  - **Itinerary pane** — list of days, each with ordered places; per-place: name, description, duration, category, address.
  - **Map pane** — Leaflet map with colored markers. A day selector toggles which day's markers are visible; "All days" mode shows everything in distinct colors.
- AI agent capable of creating, editing, and refining multi-day trips using tool calls.
- Shareable trip URL (`/trip/:id`).
- Export trip as JSON (initially — GeoJSON stretch goal).

### Out of scope (MVP)
- User accounts, OAuth, email verification.
- Payments, bookings, real-time availability.
- Mobile apps — mobile-responsive web only.
- Route optimization / TSP solving (pins are ordered by the agent's semantic choice).
- Yandex Maps integration (we use OSM via Leaflet; can be swapped post-MVP).

### Stretch goals (if time allows)
- Drag-and-drop reordering of places within a day.
- Travel-time estimation between consecutive places (OSRM public API).
- Public share link with read-only view.
- Trip cover image via OSM photo proxy or Unsplash.

## 3. Architecture

### Top-level layout
```
TripPlanner/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI routers
│   │   ├── agent/            # LLM agent: tools, system prompt, streaming
│   │   ├── db/               # SQLAlchemy models, session, migrations
│   │   ├── schemas/          # Pydantic DTOs
│   │   ├── services/         # Business logic (trip, geocoding)
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/            # HomePage, TripPage
│   │   ├── components/       # MapView, ChatPanel, Itinerary, DaySelector
│   │   ├── api/              # Typed API client
│   │   ├── store/            # Zustand stores
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
├── docker-compose.yml        # Podman-compatible; brings up postgres + backend + frontend
├── Makefile                  # dev / build / migrate / seed / test targets
├── .env.example
└── docs/superpowers/specs/
```

### Runtime topology
- **Postgres 16** — primary data store.
- **Backend** — FastAPI on `:8000`, async SQLAlchemy over asyncpg, talks to Anthropic API.
- **Frontend** — Vite dev server on `:5173` (proxied to `:8000` for `/api/*`); production build served by nginx in container.
- **Local dev**: start postgres via compose, run backend with `uvicorn --reload`, frontend with `vite`. Compose file targets everything for one-shot "it just works" via `make up`.

### Data flow for "create trip"
1. User submits form → `POST /api/trips` → trip row created, `session_id` cookie issued if missing.
2. Frontend navigates to `/trip/:id`.
3. Trip page opens websocket (or SSE) `GET /api/trips/:id/agent/stream`.
4. Frontend sends initial message "Spanned this trip: Kazan, 3 days, culture + food".
5. Backend invokes Haiku 4.5 with system prompt + tool schema; agent emits tool calls:
   - `search_place(query)` → hits Nominatim → returns candidates with lat/lon.
   - `add_place(day, name, description, lat, lon, duration_minutes, category)` → inserts row, returns place id.
   - `remove_place(place_id)` → delete.
   - `update_place(place_id, fields)` → patch.
   - `set_trip_summary(text)` → writes trip overview.
6. After each tool call, backend broadcasts the updated state to frontend over the same stream. Frontend re-renders itinerary and map.

## 4. Data model

```sql
-- Trip: top-level container
trips (
  id UUID PK,
  session_id TEXT NOT NULL,        -- anonymous owner
  title TEXT,
  destination TEXT NOT NULL,       -- "Казань"
  start_date DATE,
  end_date DATE,
  travelers INT DEFAULT 1,
  interests TEXT[] DEFAULT '{}',
  summary TEXT,                    -- agent-written paragraph
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Day: one per trip-day
days (
  id UUID PK,
  trip_id UUID FK trips ON DELETE CASCADE,
  day_number INT NOT NULL,         -- 1, 2, 3...
  date DATE,
  title TEXT,                      -- "Day 1: Old town"
  UNIQUE (trip_id, day_number)
)

-- Place: single pin on the map
places (
  id UUID PK,
  day_id UUID FK days ON DELETE CASCADE,
  order_index INT NOT NULL,        -- position in the day
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                   -- museum/restaurant/park/landmark/...
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  address TEXT,
  duration_minutes INT,
  UNIQUE (day_id, order_index)
)

-- Message: chat history
messages (
  id UUID PK,
  trip_id UUID FK trips ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user','assistant','tool')),
  content JSONB,                   -- raw Anthropic message block
  created_at TIMESTAMPTZ
)
```

Indexes: `trips(session_id, created_at DESC)`, `days(trip_id)`, `places(day_id, order_index)`, `messages(trip_id, created_at)`.

## 5. API Surface

All endpoints under `/api`. JSON in/out, `Content-Type: application/json`. Anonymous `session_id` stored in an `HttpOnly` cookie; issued on first trip creation.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/trips` | Create trip (body: destination, dates, interests, travelers). Returns trip with empty days. |
| `GET` | `/trips/:id` | Full trip (trip + days + places + messages). |
| `GET` | `/trips` | List trips for current session. |
| `DELETE` | `/trips/:id` | Delete trip. |
| `PATCH` | `/trips/:id` | Update trip metadata (title, dates...). |
| `POST` | `/trips/:id/messages` | Send a chat message; server streams agent response (SSE). |
| `POST` | `/places/:id/reorder` | Move place within day or across days. (stretch) |
| `DELETE` | `/places/:id` | Remove a place manually. |
| `GET` | `/geocode?q=...` | Frontend proxy to Nominatim (for manual searching). |

**Streaming:** `POST /trips/:id/messages` returns `text/event-stream`. Event types:
- `token` — agent text delta
- `tool_call` — agent invoked a tool (args + result)
- `state` — latest full trip state (days + places)
- `done` — stream complete

## 6. LLM agent

### Model
- `claude-haiku-4-5-20251001` via Anthropic SDK.
- Prompt caching enabled on the system prompt + tool definitions (they're static per request).
- Max 10 agentic tool-call turns per user message.

### System prompt (key bullets)
- Agent is "Travel Buddy", a Russian-speaking trip planner specialized in Russia.
- Must use tools to mutate state — **never** invent coordinates. Always call `search_place` first to get lat/lon.
- Prefer real, well-known attractions; cluster nearby places into the same day to minimize travel.
- Respect the trip's interest profile (culture/food/nature/active/nightlife/family).
- Output conversational text in Russian; tool args remain in English/transliteration where needed.

### Tools
```python
search_place(query: str, near_city: str) -> list[{name, lat, lon, address, category}]
add_place(day_number: int, name: str, description: str, lat: float, lon: float,
          duration_minutes: int, category: str, address: str | None) -> {place_id, order_index}
remove_place(place_id: str) -> {ok: bool}
update_place(place_id: str, fields: dict) -> {ok: bool}
reorder_places(day_number: int, place_ids_in_order: list[str]) -> {ok: bool}
set_trip_summary(summary: str) -> {ok: bool}
set_day_title(day_number: int, title: str) -> {ok: bool}
```

### Error handling
- If `search_place` returns zero hits: agent tells the user and asks to rephrase.
- If Anthropic API errors: propagate human-readable error over stream, do not mutate state.
- Rate limits: surface `429` to user as "I'm thinking too fast, try again in a few seconds."

## 7. Frontend design

### Visual direction
Produced via `frontend-design` skill on the initial pass and for any significant UI component added later. The skill is invoked with the project context (Russian travel, modern, warm, mapped) to produce non-generic layouts — avoid vanilla "AI chat on the left, stuff on the right" defaults.

### Pages
- **Home (`/`)** — hero section with generated Russian-city imagery, form card, recent-trips rail (from session).
- **Trip (`/trip/:id`)** — three-pane layout on desktop (chat | itinerary | map), collapsible to tabs on mobile. Day selector above the map; map is full-height, sticky.
- **Empty/loading/error** states for all of the above.

### State
- `@tanstack/react-query` for server state (trips, messages).
- `zustand` for UI state (selected day, map focus, chat composer).
- `react-leaflet` for maps, styled OSM tiles.
- `framer-motion` for micro-animations on day-toggle and marker add.

### Keyboard & accessibility
- Day selector navigable with `1`–`9` keys.
- Focus rings on all interactive elements.
- Proper `aria-live` for streaming chat.

## 8. DevX & deployment

### Makefile (top-level)
```
make install        # install backend + frontend deps
make dev            # run all 3 (postgres via compose, backend, frontend)
make up             # compose up -d (full stack in containers)
make down           # compose down
make migrate        # alembic upgrade head
make seed           # create sample data
make test           # backend pytest + frontend vitest
make lint           # ruff + eslint
make fmt            # ruff format + prettier
```

### Compose (Podman-compatible, Docker syntax)
- Services: `postgres`, `backend`, `frontend`.
- Named volume for postgres data.
- Health checks so backend waits for postgres.
- `.env.example` is committed; real `.env` is gitignored and holds `ANTHROPIC_API_KEY`, `DATABASE_URL`, `CORS_ORIGINS`.

### Migrations
- Alembic, autogenerate off the models.
- `make migrate` runs on container start via entrypoint in backend image.

## 9. Testing strategy

- **Backend**: pytest with `pytest-asyncio`, `httpx.AsyncClient` against a dedicated test DB (docker-composed or transactionally rolled back). Cover: model CRUD, endpoint happy paths, a mocked-agent trip creation flow.
- **Frontend**: Vitest + React Testing Library for core components (MapView day-toggle, Itinerary, ChatPanel message rendering). Playwright smoke test is a stretch goal.
- **Manual UI verification**: `claude-in-chrome` MCP on key flows: home form → chat → day-toggle → place-removed — captured before declaring the task complete.

## 10. Risks & open questions

| Risk | Mitigation |
|---|---|
| Nominatim rate limits (1 req/s) | Cache geocode results per-trip in DB; queue tool calls. |
| Agent hallucinating places | Mandatory `search_place` before `add_place`; reject pins without lat/lon. |
| Haiku 4.5 tool-loop cost | Cap 10 tool calls/turn; prompt caching on system prompt. |
| OSM tile provider rate limits | Use the official tile server with proper attribution; add in-memory tile cache behind dev proxy. |
| Podman-vs-Docker compose quirks | Stick to plain `docker-compose.yml` v3 syntax; no Docker-only features (BuildKit `--mount=type=cache` etc). |

## 11. Out-of-scope (explicit)

- Push notifications, SMS.
- Multi-language i18n (Russian UI only; agent speaks Russian).
- Admin panel / moderation.
- Analytics / telemetry.

## 12. Success criteria

- User can open `/`, submit "Казань, 3 дня, культура + еда", and within ~30 seconds see a plan with ~12 pinned places across 3 days, all with real coordinates, on a map they can toggle by day.
- User can ask "remove the museum on day 2" and see it disappear from both list and map.
- Refreshing the page rehydrates the trip from the DB.
- `make dev` starts everything locally with nothing more than an `ANTHROPIC_API_KEY` in `.env`.
