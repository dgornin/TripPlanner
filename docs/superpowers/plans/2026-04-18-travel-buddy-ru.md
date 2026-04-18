# Travel Buddy RU Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack AI trip planner for Russia that covers every item on the course rubric (12/12): landing, auth, LLM agent, RAG, Telegram bot, voice input, admin dashboard, funnel analytics.

**Architecture:** React (Vite+TS+Tailwind) SPA for the UI; FastAPI+SQLAlchemy+Pydantic backend; Postgres with `pgvector` for storage and embeddings; Anthropic Haiku 4.5 for the agent; python-telegram-bot for the TG integration; Leaflet for maps. Everything runs under Podman-compatible `docker-compose.yml`.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy (async, asyncpg), Alembic, Pydantic v2, Anthropic SDK, sentence-transformers, pgvector, faster-whisper, python-telegram-bot, React 18, Vite, TypeScript, Tailwind, React-Leaflet, @tanstack/react-query, zustand, recharts, framer-motion.

---

## Legend

- **Tests as value gates.** Write tests for behavior (auth flows, CRUD, agent tool execution, RAG retrieval). Skip TDD for scaffolding (config files).
- **Commit after each task.** Working tree stays runnable.
- **`frontend-design` skill invocation** is called out explicitly — do NOT hand-author these pages' visuals; invoke the skill with the project-specific brief.
- **Chrome MCP verification** happens in Task 25.

---

## PHASE 1 — Foundations

### Task 1: Project skeleton, env files, Makefile, top-level gitignore

**Files:**
- Create: `.env.example`
- Create: `Makefile`
- Modify: `.gitignore` (append frontend + node patterns)
- Create: `README.md` (short top-level intro — NOT per-component docs yet)

- [ ] **Step 1: Create `.env.example`**

```
# Anthropic
ANTHROPIC_API_KEY=

# Postgres (dev default uses compose service name)
POSTGRES_USER=travelbuddy
POSTGRES_PASSWORD=travelbuddy
POSTGRES_DB=travelbuddy
DATABASE_URL=postgresql+asyncpg://travelbuddy:travelbuddy@localhost:5432/travelbuddy

# Auth
JWT_SECRET=change-me-to-a-long-random-string
JWT_ALG=HS256
JWT_EXP_HOURS=72

# CORS (comma-separated)
CORS_ORIGINS=http://localhost:5173

# Telegram
TELEGRAM_BOT_TOKEN=

# Whisper STT fallback (set USE_WHISPER=false to disable the route)
USE_WHISPER=true
STT_MODEL=small

# RAG seed
SEED_RAG_ON_STARTUP=true
```

- [ ] **Step 2: Append to `.gitignore`**

```
# Node
node_modules/
dist/
.vite/

# Frontend env
frontend/.env.local

# Real env
.env

# Whisper model cache
.cache/
~/.cache/huggingface
```

- [ ] **Step 3: Create `Makefile`**

```make
SHELL := /bin/bash
.DEFAULT_GOAL := help

help:
	@echo "Targets: install, up, down, dev, backend-dev, frontend-dev, bot-dev, migrate, seed-rag, test, lint, fmt"

install:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
	cd frontend && npm install

up:
	docker compose up -d --build

down:
	docker compose down

dev: up-postgres backend-dev frontend-dev

up-postgres:
	docker compose up -d postgres

backend-dev:
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend-dev:
	cd frontend && npm run dev

bot-dev:
	cd backend && .venv/bin/python -m app.bot.main

migrate:
	cd backend && .venv/bin/alembic upgrade head

seed-rag:
	cd backend && .venv/bin/python -m app.rag.seed

test:
	cd backend && .venv/bin/pytest -q
	cd frontend && npm test

lint:
	cd backend && .venv/bin/ruff check .
	cd frontend && npm run lint

fmt:
	cd backend && .venv/bin/ruff format .
	cd frontend && npm run fmt
```

- [ ] **Step 4: Overwrite top-level `README.md`**

```markdown
# Travel Buddy RU

AI trip planner for Russia. Speak or type, get a multi-day plan with pins on a map,
refine by chat or Telegram, share the result. Built on Anthropic Claude Haiku 4.5.

## Quick start

```
cp .env.example .env          # fill in ANTHROPIC_API_KEY and TELEGRAM_BOT_TOKEN
make install                  # installs backend + frontend deps
make up                       # starts Postgres + backend + bot + frontend
open http://localhost:5173
```

See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for the build plan.
```

- [ ] **Step 5: Commit**

```bash
git add .env.example Makefile .gitignore README.md
git commit -m "chore: add env example, Makefile, top-level readme"
```

---

### Task 2: docker-compose.yml (Podman-compatible, pgvector)

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Write compose file**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build:
      context: ./backend
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      JWT_SECRET: ${JWT_SECRET}
      JWT_ALG: ${JWT_ALG}
      JWT_EXP_HOURS: ${JWT_EXP_HOURS}
      CORS_ORIGINS: ${CORS_ORIGINS}
      USE_WHISPER: ${USE_WHISPER}
      STT_MODEL: ${STT_MODEL}
      SEED_RAG_ON_STARTUP: ${SEED_RAG_ON_STARTUP}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "8000:8000"

  bot:
    build:
      context: ./backend
    command: ["python", "-m", "app.bot.main"]
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      backend:
        condition: service_started

  frontend:
    build:
      context: ./frontend
    environment:
      VITE_API_BASE: http://localhost:8000
    depends_on:
      - backend
    ports:
      - "5173:80"

volumes:
  pgdata: {}
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add Podman-compatible compose with pgvector postgres"
```

---

### Task 3: Backend project init (pyproject, package layout, FastAPI app)

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/Dockerfile`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: `backend/pyproject.toml`**

```toml
[project]
name = "travelbuddy"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.110",
  "uvicorn[standard]>=0.29",
  "pydantic>=2.6",
  "pydantic-settings>=2.2",
  "sqlalchemy[asyncio]>=2.0.30",
  "asyncpg>=0.29",
  "alembic>=1.13",
  "pgvector>=0.2.5",
  "anthropic>=0.39",
  "httpx>=0.27",
  "python-jose[cryptography]>=3.3",
  "passlib[bcrypt]>=1.7",
  "sentence-transformers>=2.7",
  "python-telegram-bot>=21.0",
  "python-multipart>=0.0.9",
  "faster-whisper>=1.0; platform_system != 'Windows'",
  "sse-starlette>=2.1",
  "email-validator>=2.1"
]

[project.optional-dependencies]
dev = [
  "pytest>=8.2",
  "pytest-asyncio>=0.23",
  "pytest-cov>=5",
  "ruff>=0.4",
  "respx>=0.21"
]

[tool.setuptools]
packages = ["app"]

[tool.pytest.ini_options]
asyncio_mode = "auto"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E","F","I","B","UP","PL","RUF"]
ignore = ["PLR0913", "PLR2004"]
```

- [ ] **Step 2: `backend/Dockerfile`**

```dockerfile
FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ffmpeg \
  && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e ".[dev]"
COPY . .
EXPOSE 8000
```

- [ ] **Step 3: `backend/app/core/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://travelbuddy:travelbuddy@localhost:5432/travelbuddy"
    ANTHROPIC_API_KEY: str = ""
    JWT_SECRET: str = "change-me"
    JWT_ALG: str = "HS256"
    JWT_EXP_HOURS: int = 72
    CORS_ORIGINS: str = "http://localhost:5173"
    USE_WHISPER: bool = True
    STT_MODEL: str = "small"
    SEED_RAG_ON_STARTUP: bool = True
    TELEGRAM_BOT_TOKEN: str = ""
    NOMINATIM_USER_AGENT: str = "travel-buddy-ru/0.1 (dgornin@gmail.com)"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: `backend/app/main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup hooks (RAG seed, etc.) wired in later tasks
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Travel Buddy RU", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health() -> dict:
        return {"ok": True}

    return app


app = create_app()
```

- [ ] **Step 5: `backend/tests/conftest.py`**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

- [ ] **Step 6: `backend/tests/test_health.py`**

```python
async def test_health_ok(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
```

- [ ] **Step 7: Install deps and run tests**

Run: `cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]" && .venv/bin/pytest -q`
Expected: `1 passed`.

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat(backend): FastAPI skeleton with health check and pyproject"
```

---

### Task 4: Database models + Alembic migration

**Files:**
- Create: `backend/app/db/__init__.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/models.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/0001_init.py`

- [ ] **Step 1: `backend/app/db/base.py`**

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

- [ ] **Step 2: `backend/app/db/session.py`**

```python
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with SessionLocal() as session:
        yield session
```

- [ ] **Step 3: `backend/app/db/models.py`** — all ORM models

```python
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY, BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey,
    Index, Integer, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    telegram_user_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    telegram_link_code: Mapped[str | None] = mapped_column(String(12))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trips: Mapped[list[Trip]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Trip(Base):
    __tablename__ = "trips"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200))
    destination: Mapped[str] = mapped_column(String(200), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    travelers: Mapped[int] = mapped_column(Integer, default=1)
    interests: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    summary: Mapped[str | None] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(back_populates="trips")
    days: Mapped[list[Day]] = relationship(back_populates="trip", cascade="all, delete-orphan", order_by="Day.day_number")
    messages: Mapped[list[Message]] = relationship(back_populates="trip", cascade="all, delete-orphan", order_by="Message.created_at")


class Day(Base):
    __tablename__ = "days"
    __table_args__ = (UniqueConstraint("trip_id", "day_number"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[date | None] = mapped_column(Date)
    title: Mapped[str | None] = mapped_column(String(200))

    trip: Mapped[Trip] = relationship(back_populates="days")
    places: Mapped[list[Place]] = relationship(back_populates="day", cascade="all, delete-orphan", order_by="Place.order_index")


class Place(Base):
    __tablename__ = "places"
    __table_args__ = (UniqueConstraint("day_id", "order_index"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    day_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("days.id", ondelete="CASCADE"), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(60))
    lat: Mapped[float] = mapped_column(nullable=False)
    lon: Mapped[float] = mapped_column(nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)

    day: Mapped[Day] = relationship(back_populates="places")


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (CheckConstraint("role in ('user','assistant','tool','system')"),)

    trip: Mapped[Trip] = relationship(back_populates="messages")


class KbChunk(Base):
    __tablename__ = "kb_chunks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_title: Mapped[str] = mapped_column(String(300))
    source_url: Mapped[str | None] = mapped_column(String(600))
    city: Mapped[str | None] = mapped_column(String(120))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(384), nullable=False)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    session_id: Mapped[str | None] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(60), nullable=False)
    props: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_events_type_created", "type", "created_at"),
        Index("ix_events_user", "user_id"),
    )
```

- [ ] **Step 4: `backend/alembic.ini`**

```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql://travelbuddy:travelbuddy@localhost:5432/travelbuddy

[loggers]
keys = root

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARNING
handlers = console

[handler_console]
class = StreamHandler
args = (sys.stdout,)
formatter = generic

[formatter_generic]
format = %(levelname)s %(name)s: %(message)s
```

- [ ] **Step 5: `backend/alembic/env.py`**

```python
import asyncio
from logging.config import fileConfig
from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy.engine import Connection

from app.core.config import get_settings
from app.db.base import Base
from app.db import models  # noqa: F401 — register models

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

- [ ] **Step 6: `backend/alembic/script.py.mako`**

```mako
"""${message}
Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}
"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 7: Create initial migration `backend/alembic/versions/0001_init.py`**

```python
"""init schema with pgvector

Revision ID: 0001
Revises:
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(120)),
        sa.Column("is_admin", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("telegram_user_id", sa.BigInteger, unique=True),
        sa.Column("telegram_link_code", sa.String(12)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "trips",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(200)),
        sa.Column("destination", sa.String(200), nullable=False),
        sa.Column("start_date", sa.Date),
        sa.Column("end_date", sa.Date),
        sa.Column("travelers", sa.Integer, server_default="1"),
        sa.Column("interests", postgresql.ARRAY(sa.String), server_default="{}"),
        sa.Column("summary", sa.Text),
        sa.Column("is_public", sa.Boolean, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "days",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_number", sa.Integer, nullable=False),
        sa.Column("date", sa.Date),
        sa.Column("title", sa.String(200)),
        sa.UniqueConstraint("trip_id", "day_number"),
    )

    op.create_table(
        "places",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("day_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("days.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_index", sa.Integer, nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("category", sa.String(60)),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lon", sa.Float, nullable=False),
        sa.Column("address", sa.Text),
        sa.Column("duration_minutes", sa.Integer),
        sa.UniqueConstraint("day_id", "order_index"),
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("trip_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", postgresql.JSONB, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("role in ('user','assistant','tool','system')"),
    )

    op.create_table(
        "kb_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_title", sa.String(300)),
        sa.Column("source_url", sa.String(600)),
        sa.Column("city", sa.String(120)),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("embedding", Vector(384), nullable=False),
    )
    op.execute("CREATE INDEX kb_chunks_embedding_idx ON kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)")

    op.create_table(
        "events",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("session_id", sa.String(64)),
        sa.Column("type", sa.String(60), nullable=False),
        sa.Column("props", postgresql.JSONB, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_events_type_created", "events", ["type", "created_at"])
    op.create_index("ix_events_user", "events", ["user_id"])


def downgrade() -> None:
    for t in ("events", "kb_chunks", "messages", "places", "days", "trips", "users"):
        op.drop_table(t)
    op.execute("DROP EXTENSION IF EXISTS vector")
```

- [ ] **Step 8: Run migration against local postgres**

Run (after `docker compose up -d postgres` or local pg is running):

```
cd backend && .venv/bin/alembic upgrade head
```

Expected: `INFO ... Running upgrade -> 0001`.

- [ ] **Step 9: Commit**

```bash
git add backend/app/db backend/alembic*
git commit -m "feat(backend): initial schema with pgvector"
```

---

### Task 5: Frontend scaffolding (Vite + React + TS + Tailwind + Router)

**Files (in `frontend/`):**
- Create entire Vite-React-TS project with manual config for Tailwind.

- [ ] **Step 1: Scaffold via Vite**

Run:
```
cd frontend && npm create vite@latest . -- --template react-ts
# accept defaults, overwrite existing files if prompted with Yes
```

- [ ] **Step 2: Install deps**

Run:
```
cd frontend
npm i react-router-dom @tanstack/react-query zustand react-leaflet leaflet framer-motion recharts axios
npm i -D tailwindcss postcss autoprefixer @types/leaflet vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom prettier eslint eslint-plugin-react eslint-plugin-react-hooks
npx tailwindcss init -p
```

- [ ] **Step 3: Replace `frontend/tailwind.config.js` with `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#f97316",
          600: "#ea580c",
          900: "#7c2d12",
        },
        ink: {
          900: "#0b1220",
          700: "#1f2937",
          500: "#6b7280",
          100: "#f3f4f6",
        },
      },
      fontFamily: {
        display: ['"Unbounded"', "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 20px 60px -20px rgba(0,0,0,0.2)",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

Remove the old `tailwind.config.js`.

- [ ] **Step 4: Update `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Unbounded:wght@500;700&display=swap");

:root { color-scheme: light; }
html, body, #root { height: 100%; }
body { @apply bg-ink-100 text-ink-900 font-sans antialiased; }

/* leaflet default */
.leaflet-container { width: 100%; height: 100%; }
```

- [ ] **Step 5: `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 6: `frontend/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 7: Replace `frontend/src/App.tsx` with minimal router shell**

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";

function Placeholder({ text }: { text: string }) {
  return <div className="p-8 text-2xl font-display">{text}</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder text="Landing placeholder" />} />
        <Route path="/login" element={<Placeholder text="Login placeholder" />} />
        <Route path="/signup" element={<Placeholder text="Signup placeholder" />} />
        <Route path="/app/*" element={<Placeholder text="App placeholder" />} />
        <Route path="*" element={<Placeholder text="404" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 8: `frontend/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import "leaflet/dist/leaflet.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 9: `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 10: `frontend/nginx.conf`**

```
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location /api/ { proxy_pass http://backend:8000; }
  location / { try_files $uri /index.html; }
}
```

- [ ] **Step 11: Add `package.json` scripts**

Add/replace:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "lint": "eslint 'src/**/*.{ts,tsx}'",
  "fmt": "prettier --write 'src/**/*.{ts,tsx,css}'"
}
```

- [ ] **Step 12: Run dev server and capture screenshot**

Run in background: `cd frontend && npm run dev`
Verify: `curl -sI http://localhost:5173 | head -1` → `HTTP/1.1 200`.

- [ ] **Step 13: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold Vite React TS Tailwind with router and leaflet"
```

---

## PHASE 2 — Backend Core

### Task 6: Auth (signup / login / logout / me)

**Files:**
- Create: `backend/app/core/security.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/deps.py`
- Create: `backend/app/api/auth.py`
- Modify: `backend/app/main.py` (include router)
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: `backend/app/core/security.py`**

```python
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def make_access_token(user_id: str, is_admin: bool) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "adm": is_admin,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=settings.JWT_EXP_HOURS)).timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    except JWTError:
        return None
```

- [ ] **Step 2: `backend/app/schemas/auth.py`**

```python
from pydantic import BaseModel, EmailStr, Field


class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    display_name: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str | None
    is_admin: bool

    class Config:
        from_attributes = True
```

- [ ] **Step 3: `backend/app/api/deps.py`**

```python
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db

COOKIE_NAME = "access_token"


async def current_user(
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = (await db.execute(select(User).where(User.id == payload["sub"]))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def admin_user(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user
```

- [ ] **Step 4: `backend/app/api/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import COOKIE_NAME, current_user
from app.core.config import get_settings
from app.core.security import hash_password, make_access_token, verify_password
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import LoginIn, SignupIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _set_cookie(resp: Response, token: str) -> None:
    resp.set_cookie(
        COOKIE_NAME, token,
        httponly=True, samesite="lax", secure=False,
        max_age=settings.JWT_EXP_HOURS * 3600, path="/",
    )


@router.post("/signup", response_model=UserOut)
async def signup(body: SignupIn, resp: Response, db: AsyncSession = Depends(get_db)):
    exists = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    _set_cookie(resp, make_access_token(str(user.id), user.is_admin))
    return UserOut(id=str(user.id), email=user.email, display_name=user.display_name, is_admin=user.is_admin)


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, resp: Response, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    _set_cookie(resp, make_access_token(str(user.id), user.is_admin))
    return UserOut(id=str(user.id), email=user.email, display_name=user.display_name, is_admin=user.is_admin)


@router.post("/logout")
async def logout(resp: Response):
    resp.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)):
    return UserOut(id=str(user.id), email=user.email, display_name=user.display_name, is_admin=user.is_admin)
```

- [ ] **Step 5: Mount router in `main.py`**

Edit `backend/app/main.py`'s `create_app`:

```python
from app.api.auth import router as auth_router
...
    app.include_router(auth_router)
```

- [ ] **Step 6: `backend/tests/test_auth.py`**

```python
import pytest

@pytest.mark.anyio
async def test_signup_login_logout_me(client):
    # signup
    r = await client.post("/api/auth/signup", json={"email": "a@b.c", "password": "secret1"})
    assert r.status_code == 200, r.text
    user = r.json()
    assert user["email"] == "a@b.c"
    assert "access_token" in r.cookies

    # me
    r2 = await client.get("/api/auth/me", cookies=r.cookies)
    assert r2.status_code == 200
    assert r2.json()["email"] == "a@b.c"

    # logout
    r3 = await client.post("/api/auth/logout", cookies=r.cookies)
    assert r3.status_code == 200

    # login
    r4 = await client.post("/api/auth/login", json={"email": "a@b.c", "password": "secret1"})
    assert r4.status_code == 200
    assert "access_token" in r4.cookies
```

- [ ] **Step 7: Test harness needs a test DB**

Extend `conftest.py` so tests get a throwaway DB. If the dev DB is available, we can reuse it with transactional rollback — but for simplicity, spin a SQLite-compatible fake? **No**, we use pgvector/JSONB. Instead: require a test Postgres. Create `backend/tests/conftest.py`:

```python
import asyncio
import os
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core.config import get_settings
from app.db.base import Base
from app.db import models  # noqa
from app.db.session import get_db
from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def engine():
    settings = get_settings()
    dbname = f"tb_test_{uuid.uuid4().hex[:8]}"
    admin_url = settings.DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as c:
        await c.exec_driver_sql(f'CREATE DATABASE "{dbname}"')
    await admin_engine.dispose()

    test_url = settings.DATABASE_URL.rsplit("/", 1)[0] + f"/{dbname}"
    e = create_async_engine(test_url)
    async with e.begin() as conn:
        await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.run_sync(Base.metadata.create_all)
    yield e
    await e.dispose()

    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as c:
        await c.exec_driver_sql(f'DROP DATABASE "{dbname}"')
    await admin_engine.dispose()


@pytest.fixture
async def db_session(engine):
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as s:
        yield s
        await s.rollback()


@pytest.fixture
async def client(engine):
    maker = async_sessionmaker(engine, expire_on_commit=False)

    async def override_db():
        async with maker() as s:
            yield s

    app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 8: Run tests**

Precondition: local postgres at the URL in `DATABASE_URL` is reachable. If running via `docker compose up -d postgres` the env points at `localhost:5432`.

Run: `cd backend && .venv/bin/pytest tests/test_auth.py -q`
Expected: `1 passed`.

- [ ] **Step 9: Commit**

```bash
git add backend/app/api backend/app/core/security.py backend/app/schemas backend/tests
git commit -m "feat(backend): email+password auth with JWT cookie"
```

---

### Task 7: Events pipeline (write + SDK endpoint)

**Files:**
- Create: `backend/app/schemas/events.py`
- Create: `backend/app/api/events.py`
- Create: `backend/tests/test_events.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: `backend/app/schemas/events.py`**

```python
from pydantic import BaseModel, Field


class EventIn(BaseModel):
    type: str = Field(min_length=1, max_length=60)
    props: dict = Field(default_factory=dict)
    session_id: str | None = None
```

- [ ] **Step 2: `backend/app/api/events.py`**

```python
from fastapi import APIRouter, Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.models import Event
from app.db.session import get_db
from app.schemas.events import EventIn

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("")
async def log_event(
    body: EventIn,
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Cookie(default=None),
):
    user_id = None
    if access_token:
        payload = decode_access_token(access_token)
        if payload:
            user_id = payload["sub"]
    event = Event(user_id=user_id, session_id=body.session_id, type=body.type, props=body.props)
    db.add(event)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 3: `backend/tests/test_events.py`**

```python
from sqlalchemy import select
from app.db.models import Event


async def test_event_logged(client, db_session):
    r = await client.post("/api/events", json={"type": "page_view", "props": {"path": "/"}})
    assert r.status_code == 200
    rows = (await db_session.execute(select(Event))).scalars().all()
    assert len(rows) == 1
    assert rows[0].type == "page_view"
```

- [ ] **Step 4: Mount in main.py + run**

Add `from app.api.events import router as events_router` and `app.include_router(events_router)`.

Run: `cd backend && .venv/bin/pytest tests/test_events.py -q` → pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/events.py backend/app/schemas/events.py backend/tests/test_events.py backend/app/main.py
git commit -m "feat(backend): analytics events endpoint"
```

---

### Task 8: Trip CRUD (create, list, get, delete, patch, share)

**Files:**
- Create: `backend/app/schemas/trips.py`
- Create: `backend/app/api/trips.py`
- Create: `backend/tests/test_trips.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: `backend/app/schemas/trips.py`**

```python
from datetime import date, datetime
from pydantic import BaseModel, Field


class PlaceOut(BaseModel):
    id: str
    order_index: int
    name: str
    description: str | None
    category: str | None
    lat: float
    lon: float
    address: str | None
    duration_minutes: int | None


class DayOut(BaseModel):
    id: str
    day_number: int
    date: date | None
    title: str | None
    places: list[PlaceOut]


class TripBase(BaseModel):
    title: str | None = None
    destination: str = Field(min_length=1, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    travelers: int = 1
    interests: list[str] = Field(default_factory=list)


class TripCreate(TripBase):
    pass


class TripPatch(BaseModel):
    title: str | None = None
    is_public: bool | None = None


class TripSummary(BaseModel):
    id: str
    title: str | None
    destination: str
    start_date: date | None
    end_date: date | None
    created_at: datetime
    is_public: bool


class TripOut(TripBase):
    id: str
    summary: str | None
    is_public: bool
    days: list[DayOut]
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2: `backend/app/api/trips.py`**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import current_user
from app.db.models import Day, Event, Place, Trip, User
from app.db.session import get_db
from app.schemas.trips import (
    DayOut, PlaceOut, TripCreate, TripOut, TripPatch, TripSummary,
)

router = APIRouter(prefix="/api/trips", tags=["trips"])


def _place_out(p: Place) -> PlaceOut:
    return PlaceOut(
        id=str(p.id), order_index=p.order_index, name=p.name,
        description=p.description, category=p.category,
        lat=p.lat, lon=p.lon, address=p.address, duration_minutes=p.duration_minutes,
    )


def _day_out(d: Day) -> DayOut:
    return DayOut(
        id=str(d.id), day_number=d.day_number, date=d.date, title=d.title,
        places=[_place_out(p) for p in d.places],
    )


def _trip_out(t: Trip) -> TripOut:
    return TripOut(
        id=str(t.id), title=t.title, destination=t.destination,
        start_date=t.start_date, end_date=t.end_date, travelers=t.travelers,
        interests=list(t.interests or []), summary=t.summary, is_public=t.is_public,
        days=[_day_out(d) for d in t.days], created_at=t.created_at, updated_at=t.updated_at,
    )


@router.post("", response_model=TripOut)
async def create_trip(body: TripCreate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    trip = Trip(
        user_id=user.id, title=body.title, destination=body.destination,
        start_date=body.start_date, end_date=body.end_date,
        travelers=body.travelers, interests=body.interests,
    )
    if body.start_date and body.end_date:
        n = (body.end_date - body.start_date).days + 1
        for i in range(n):
            trip.days.append(Day(day_number=i + 1))
    db.add(trip)
    await db.flush()
    db.add(Event(user_id=user.id, type="trip_created", props={"trip_id": str(trip.id), "destination": trip.destination}))
    await db.commit()
    trip = (await db.execute(
        select(Trip).options(selectinload(Trip.days).selectinload(Day.places)).where(Trip.id == trip.id)
    )).scalar_one()
    return _trip_out(trip)


@router.get("", response_model=list[TripSummary])
async def list_trips(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Trip).where(Trip.user_id == user.id).order_by(Trip.created_at.desc())
    )).scalars().all()
    return [
        TripSummary(
            id=str(t.id), title=t.title, destination=t.destination,
            start_date=t.start_date, end_date=t.end_date,
            created_at=t.created_at, is_public=t.is_public,
        )
        for t in rows
    ]


@router.get("/{trip_id}", response_model=TripOut)
async def get_trip(trip_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    trip = (await db.execute(
        select(Trip).options(selectinload(Trip.days).selectinload(Day.places)).where(Trip.id == trip_id)
    )).scalar_one_or_none()
    if not trip or trip.user_id != user.id:
        raise HTTPException(404, "Trip not found")
    return _trip_out(trip)


@router.patch("/{trip_id}", response_model=TripOut)
async def patch_trip(trip_id: uuid.UUID, body: TripPatch, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    trip = (await db.execute(select(Trip).where(Trip.id == trip_id))).scalar_one_or_none()
    if not trip or trip.user_id != user.id:
        raise HTTPException(404, "Trip not found")
    if body.title is not None:
        trip.title = body.title
    if body.is_public is not None:
        trip.is_public = body.is_public
        if body.is_public:
            db.add(Event(user_id=user.id, type="trip_shared", props={"trip_id": str(trip.id)}))
    await db.commit()
    trip = (await db.execute(
        select(Trip).options(selectinload(Trip.days).selectinload(Day.places)).where(Trip.id == trip_id)
    )).scalar_one()
    return _trip_out(trip)


@router.delete("/{trip_id}")
async def delete_trip(trip_id: uuid.UUID, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    trip = (await db.execute(select(Trip).where(Trip.id == trip_id))).scalar_one_or_none()
    if not trip or trip.user_id != user.id:
        raise HTTPException(404, "Trip not found")
    await db.delete(trip)
    await db.commit()
    return {"ok": True}


public_router = APIRouter(prefix="/api/public", tags=["public"])


@public_router.get("/trips/{trip_id}", response_model=TripOut)
async def public_trip(trip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    trip = (await db.execute(
        select(Trip).options(selectinload(Trip.days).selectinload(Day.places)).where(Trip.id == trip_id)
    )).scalar_one_or_none()
    if not trip or not trip.is_public:
        raise HTTPException(404, "Trip not found")
    return _trip_out(trip)
```

- [ ] **Step 3: Mount routers in main.py**

Add:
```python
from app.api.trips import router as trips_router, public_router as public_trips_router
app.include_router(trips_router)
app.include_router(public_trips_router)
```

- [ ] **Step 4: `backend/tests/test_trips.py`**

```python
async def _signup(client, email="t@t.ru"):
    r = await client.post("/api/auth/signup", json={"email": email, "password": "secret1"})
    return r.cookies


async def test_trip_crud(client):
    cookies = await _signup(client)
    r = await client.post(
        "/api/trips",
        json={"destination": "Казань", "start_date": "2026-05-01", "end_date": "2026-05-03", "interests": ["culture", "food"]},
        cookies=cookies,
    )
    assert r.status_code == 200, r.text
    trip = r.json()
    assert trip["destination"] == "Казань"
    assert len(trip["days"]) == 3
    trip_id = trip["id"]

    r = await client.get("/api/trips", cookies=cookies)
    assert r.status_code == 200
    assert any(t["id"] == trip_id for t in r.json())

    r = await client.patch(f"/api/trips/{trip_id}", json={"is_public": True}, cookies=cookies)
    assert r.status_code == 200
    assert r.json()["is_public"] is True

    r = await client.get(f"/api/public/trips/{trip_id}")
    assert r.status_code == 200

    r = await client.delete(f"/api/trips/{trip_id}", cookies=cookies)
    assert r.status_code == 200
```

- [ ] **Step 5: Run tests, commit**

Run: `cd backend && .venv/bin/pytest tests/test_trips.py -q` → pass.

```bash
git add backend/app/api/trips.py backend/app/schemas/trips.py backend/tests/test_trips.py backend/app/main.py
git commit -m "feat(backend): trip CRUD with share and auto-day creation"
```

---

### Task 9: Geocoding service (Nominatim)

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/geocoding.py`
- Create: `backend/tests/test_geocoding.py`

- [ ] **Step 1: `backend/app/services/geocoding.py`**

```python
import httpx
from app.core.config import get_settings

settings = get_settings()


async def search_places(query: str, near_city: str | None = None, limit: int = 5) -> list[dict]:
    q = f"{query}, {near_city}" if near_city else query
    async with httpx.AsyncClient(timeout=10.0) as http:
        resp = await http.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "jsonv2", "limit": limit, "addressdetails": 1, "accept-language": "ru"},
            headers={"User-Agent": settings.NOMINATIM_USER_AGENT},
        )
        resp.raise_for_status()
        data = resp.json()
    return [
        {
            "name": item.get("display_name", "").split(",")[0] or query,
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
            "address": item.get("display_name"),
            "category": item.get("category") or item.get("type"),
        }
        for item in data
    ]
```

- [ ] **Step 2: `backend/tests/test_geocoding.py`** (uses respx to mock)

```python
import respx
from httpx import Response
from app.services.geocoding import search_places


@respx.mock
async def test_geocoding_parses_nominatim():
    respx.get("https://nominatim.openstreetmap.org/search").respond(
        200,
        json=[{"display_name": "Казанский Кремль, Казань", "lat": "55.7989", "lon": "49.1057", "category": "historic", "type": "fort"}],
    )
    out = await search_places("кремль", "Казань")
    assert out[0]["lat"] == 55.7989
    assert out[0]["category"] == "historic"
```

- [ ] **Step 3: Run + commit**

Run: `.venv/bin/pytest tests/test_geocoding.py -q` → pass.

```bash
git add backend/app/services/geocoding.py backend/tests/test_geocoding.py
git commit -m "feat(backend): nominatim geocoding service"
```

---

### Task 10: RAG — embedder, retriever, seed corpus

**Files:**
- Create: `backend/data/kb_russia.jsonl` (curated seed, ~40 entries covering 10 major Russian cities)
- Create: `backend/app/rag/__init__.py`
- Create: `backend/app/rag/embedder.py`
- Create: `backend/app/rag/retriever.py`
- Create: `backend/app/rag/seed.py`
- Create: `backend/tests/test_rag.py`
- Modify: `backend/app/main.py` (lifespan seeds on startup if flag)

- [ ] **Step 1: Create `backend/data/kb_russia.jsonl`**

40+ entries, one JSON per line. Cover Moscow, St. Petersburg, Kazan, Ekaterinburg, Sochi, Nizhny Novgorod, Vladivostok, Kaliningrad, Irkutsk (Baikal), Suzdal. Example format (write ALL 40):

```json
{"title":"Казанский Кремль","url":"https://ru.wikipedia.org/wiki/Казанский_кремль","city":"Казань","content":"Казанский кремль — древнейшая часть Казани. Главные объекты: Благовещенский собор (XVI в.), башня Сююмбике, мечеть Кул-Шариф. Входит в список ЮНЕСКО. Обычно закладывают 2-3 часа."}
{"title":"Улица Баумана","url":"https://ru.wikipedia.org/wiki/Улица_Баумана_(Казань)","city":"Казань","content":"Пешеходная улица в центре Казани. Рестораны татарской кухни, магазины, уличные музыканты. Хорошо совмещается с прогулкой по Кремлю."}
```

Seed with ~4 entries per each of 10 cities (Moscow: Красная площадь, ГУМ, Третьяковка, ВДНХ; Спб: Эрмитаж, Петропавловская крепость, Петергоф, Невский; Казань: Кремль, Баумана, Раифа, аквапарк Ривьера; Екб: Ельцин-Центр, Храм-на-Крови, плотинка, Ганина Яма; Сочи: Роза Хутор, Олимпийский парк, Красная Поляна, Дендрарий; Н.Новгород: Кремль, Стрелка, канатная дорога, Чкаловская лестница; Владивосток: Русский мост, Видовая, Маяк Эгершельд, Приморский океанариум; Калининград: Кафедральный собор, музей Янтаря, Куршская коса, рыбная деревня; Иркутск: Листвянка, Шаман-камень, Музей деревянного зодчества, Кругобайкальская ЖД; Суздаль: Кремль, музей деревянного зодчества, Спасо-Евфимиев монастырь, медовуха). Each entry ~50–150 Russian words.

- [ ] **Step 2: `backend/app/rag/embedder.py`**

```python
from functools import lru_cache
from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


@lru_cache
def get_model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


def embed(texts: list[str]) -> list[list[float]]:
    model = get_model()
    vecs = model.encode(texts, normalize_embeddings=True)
    return vecs.tolist()
```

- [ ] **Step 3: `backend/app/rag/retriever.py`**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import KbChunk
from app.rag.embedder import embed


async def search_kb(db: AsyncSession, query: str, city: str | None = None, k: int = 5) -> list[dict]:
    [qvec] = embed([query])
    stmt = select(KbChunk).order_by(KbChunk.embedding.cosine_distance(qvec)).limit(k)
    if city:
        stmt = select(KbChunk).where(KbChunk.city == city).order_by(KbChunk.embedding.cosine_distance(qvec)).limit(k)
    rows = (await db.execute(stmt)).scalars().all()
    return [
        {"title": r.source_title, "url": r.source_url, "city": r.city, "snippet": r.content[:500]}
        for r in rows
    ]
```

- [ ] **Step 4: `backend/app/rag/seed.py`**

```python
import asyncio
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.models import KbChunk
from app.db.session import engine
from app.rag.embedder import embed

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "kb_russia.jsonl"


async def seed_if_empty() -> int:
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with SessionLocal() as db:
        count = (await db.execute(select(KbChunk))).scalars().first()
        if count is not None:
            return 0
        records = [json.loads(line) for line in DATA_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
        vectors = embed([r["content"] for r in records])
        for rec, vec in zip(records, vectors, strict=True):
            db.add(KbChunk(
                source_title=rec["title"], source_url=rec.get("url"),
                city=rec.get("city"), content=rec["content"], embedding=vec,
            ))
        await db.commit()
        return len(records)


def main():
    n = asyncio.run(seed_if_empty())
    print(f"Seeded {n} KB chunks")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Plug into lifespan in `app/main.py`**

```python
from app.core.config import get_settings
from app.rag.seed import seed_if_empty

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.SEED_RAG_ON_STARTUP:
        try:
            await seed_if_empty()
        except Exception as exc:  # noqa: BLE001
            print(f"[lifespan] RAG seed skipped: {exc}")
    yield
```

- [ ] **Step 6: `backend/tests/test_rag.py`**

```python
from app.rag.embedder import embed
from app.rag.retriever import search_kb
from app.db.models import KbChunk


async def test_embed_and_retrieve(db_session):
    vecs = embed(["Казанский Кремль — сердце города"])
    db_session.add(KbChunk(source_title="test", city="Казань", content="Казанский Кремль является главным памятником.", embedding=vecs[0]))
    await db_session.commit()

    out = await search_kb(db_session, "Что посмотреть в Кремле?", city="Казань", k=1)
    assert len(out) == 1
    assert "Кремль" in out[0]["snippet"]
```

- [ ] **Step 7: Run + commit**

Run: `.venv/bin/pytest tests/test_rag.py -q` → pass (model auto-downloads on first run, may take ~1 min).

```bash
git add backend/app/rag backend/data backend/tests/test_rag.py backend/app/main.py
git commit -m "feat(backend): RAG with pgvector + multilingual MiniLM seed corpus"
```

---

### Task 11: LLM agent — prompt, tools, runner

**Files:**
- Create: `backend/app/agent/__init__.py`
- Create: `backend/app/agent/prompt.py`
- Create: `backend/app/agent/tools.py`
- Create: `backend/app/agent/runner.py`
- Create: `backend/tests/test_agent.py`

- [ ] **Step 1: `backend/app/agent/prompt.py`**

```python
SYSTEM_PROMPT = """Ты — Travel Buddy, дружелюбный ИИ-планировщик путешествий по России.

Принципы:
- Отвечай по-русски, коротко и по делу, в дружелюбном тоне.
- Сначала используй инструмент `kb_search`, чтобы получить факты о городе и достопримечательностях.
- Перед добавлением любой точки на карту ВСЕГДА используй `search_place` — нельзя придумывать координаты.
- Кластеризуй близкие по расположению точки в один день — так маршрут удобнее.
- Уважай интересы пользователя (culture / food / nature / active / nightlife / family).
- В начале плана вызови `set_trip_summary`, потом для каждого дня — `set_day_title` и добавь 3–6 точек через `add_place`.
- Если пользователь просит удалить/изменить точку — делай это через `remove_place`/`update_place`, а не перечисляй словами.

Ограничения:
- Максимум 12 вызовов инструментов на один ответ.
- Если `search_place` ничего не нашёл — сообщи пользователю и попроси уточнения.
"""
```

- [ ] **Step 2: `backend/app/agent/tools.py`** (tool schema + executor)

```python
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Day, Place, Trip
from app.rag.retriever import search_kb
from app.services.geocoding import search_places

TOOL_DEFS: list[dict] = [
    {
        "name": "kb_search",
        "description": "Search the internal knowledge base of Russian travel info. Call this FIRST for facts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "city": {"type": "string", "description": "Optional city filter in Russian"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "search_place",
        "description": "Find a real place by name near a city and get lat/lon. Call before add_place.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "near_city": {"type": "string"},
            },
            "required": ["query", "near_city"],
        },
    },
    {
        "name": "add_place",
        "description": "Add a place to a specific day.",
        "input_schema": {
            "type": "object",
            "properties": {
                "day_number": {"type": "integer"},
                "name": {"type": "string"},
                "description": {"type": "string"},
                "lat": {"type": "number"},
                "lon": {"type": "number"},
                "duration_minutes": {"type": "integer"},
                "category": {"type": "string"},
                "address": {"type": "string"},
            },
            "required": ["day_number", "name", "lat", "lon"],
        },
    },
    {
        "name": "remove_place",
        "description": "Remove a place by id.",
        "input_schema": {"type": "object", "properties": {"place_id": {"type": "string"}}, "required": ["place_id"]},
    },
    {
        "name": "update_place",
        "description": "Patch a place (description, duration, category).",
        "input_schema": {
            "type": "object",
            "properties": {
                "place_id": {"type": "string"},
                "fields": {"type": "object"},
            },
            "required": ["place_id", "fields"],
        },
    },
    {
        "name": "set_trip_summary",
        "description": "Set the trip-level summary paragraph.",
        "input_schema": {"type": "object", "properties": {"summary": {"type": "string"}}, "required": ["summary"]},
    },
    {
        "name": "set_day_title",
        "description": "Set a per-day title.",
        "input_schema": {
            "type": "object",
            "properties": {"day_number": {"type": "integer"}, "title": {"type": "string"}},
            "required": ["day_number", "title"],
        },
    },
]


async def _find_or_create_day(db: AsyncSession, trip_id: uuid.UUID, day_number: int) -> Day:
    day = (await db.execute(select(Day).where(Day.trip_id == trip_id, Day.day_number == day_number))).scalar_one_or_none()
    if day:
        return day
    day = Day(trip_id=trip_id, day_number=day_number)
    db.add(day)
    await db.flush()
    return day


async def execute_tool(db: AsyncSession, trip: Trip, name: str, args: dict) -> dict:
    if name == "kb_search":
        return {"results": await search_kb(db, args["query"], city=args.get("city"), k=5)}

    if name == "search_place":
        return {"results": await search_places(args["query"], near_city=args.get("near_city"), limit=5)}

    if name == "add_place":
        day = await _find_or_create_day(db, trip.id, args["day_number"])
        existing = (await db.execute(select(Place).where(Place.day_id == day.id))).scalars().all()
        order_index = max((p.order_index for p in existing), default=-1) + 1
        place = Place(
            day_id=day.id, order_index=order_index,
            name=args["name"], description=args.get("description"),
            lat=float(args["lat"]), lon=float(args["lon"]),
            duration_minutes=args.get("duration_minutes"),
            category=args.get("category"), address=args.get("address"),
        )
        db.add(place)
        await db.flush()
        return {"place_id": str(place.id), "order_index": order_index}

    if name == "remove_place":
        pid = uuid.UUID(args["place_id"])
        await db.execute(delete(Place).where(Place.id == pid))
        return {"ok": True}

    if name == "update_place":
        pid = uuid.UUID(args["place_id"])
        place = (await db.execute(select(Place).where(Place.id == pid))).scalar_one_or_none()
        if not place:
            return {"ok": False, "error": "not found"}
        for k, v in args["fields"].items():
            if hasattr(place, k):
                setattr(place, k, v)
        return {"ok": True}

    if name == "set_trip_summary":
        trip.summary = args["summary"]
        return {"ok": True}

    if name == "set_day_title":
        day = await _find_or_create_day(db, trip.id, args["day_number"])
        day.title = args["title"]
        return {"ok": True}

    return {"error": f"unknown tool {name}"}


async def snapshot_trip(db: AsyncSession, trip_id: uuid.UUID) -> dict:
    from app.api.trips import _trip_out  # avoid cycle at import time

    trip = (await db.execute(
        select(Trip).options(selectinload(Trip.days).selectinload(Day.places)).where(Trip.id == trip_id)
    )).scalar_one()
    return _trip_out(trip).model_dump(mode="json")
```

- [ ] **Step 3: `backend/app/agent/runner.py`**

```python
from __future__ import annotations

from typing import AsyncIterator, Any
import json
import uuid

from anthropic import AsyncAnthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompt import SYSTEM_PROMPT
from app.agent.tools import TOOL_DEFS, execute_tool, snapshot_trip
from app.core.config import get_settings
from app.db.models import Message, Trip

settings = get_settings()

MODEL = "claude-haiku-4-5-20251001"
MAX_TOOL_LOOPS = 12


def build_client() -> AsyncAnthropic:
    return AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


async def _history(db: AsyncSession, trip_id: uuid.UUID) -> list[dict]:
    rows = (await db.execute(
        select(Message).where(Message.trip_id == trip_id).order_by(Message.created_at)
    )).scalars().all()
    return [r.content for r in rows]


async def run_agent(
    db: AsyncSession,
    trip: Trip,
    user_text: str,
    client: AsyncAnthropic | None = None,
) -> AsyncIterator[dict]:
    """Yields events: {'type': 'token'|'tool_call'|'state'|'done'|'error', ...}"""
    client = client or build_client()

    # persist user message
    user_block = {"role": "user", "content": [{"type": "text", "text": user_text}]}
    db.add(Message(trip_id=trip.id, role="user", content=user_block))
    await db.commit()

    messages: list[dict] = await _history(db, trip.id)

    system = [
        {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": f"Контекст поездки: город={trip.destination}, интересы={trip.interests}, дней={len(trip.days)}."},
    ]

    for _ in range(MAX_TOOL_LOOPS):
        resp = await client.messages.create(
            model=MODEL,
            max_tokens=1500,
            system=system,
            tools=TOOL_DEFS,
            messages=messages,
        )
        assistant_block = {"role": "assistant", "content": [b.model_dump() for b in resp.content]}
        messages.append(assistant_block)
        db.add(Message(trip_id=trip.id, role="assistant", content=assistant_block))

        # yield text tokens
        for block in resp.content:
            if block.type == "text" and block.text:
                yield {"type": "token", "text": block.text}

        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if not tool_uses:
            await db.commit()
            yield {"type": "state", "trip": await snapshot_trip(db, trip.id)}
            yield {"type": "done"}
            return

        tool_results_content = []
        for tu in tool_uses:
            try:
                result = await execute_tool(db, trip, tu.name, tu.input or {})
            except Exception as exc:  # noqa: BLE001
                result = {"error": str(exc)}
            yield {"type": "tool_call", "name": tu.name, "input": tu.input, "result": result}
            tool_results_content.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": json.dumps(result, ensure_ascii=False)[:4000],
            })
        tool_msg = {"role": "user", "content": tool_results_content}
        messages.append(tool_msg)
        db.add(Message(trip_id=trip.id, role="tool", content=tool_msg))
        await db.commit()

        yield {"type": "state", "trip": await snapshot_trip(db, trip.id)}

    yield {"type": "error", "error": "max tool loops reached"}
```

- [ ] **Step 4: `backend/tests/test_agent.py`** — mock the Anthropic client

```python
from types import SimpleNamespace
import uuid
import pytest

from app.agent.runner import run_agent
from app.agent.tools import snapshot_trip
from app.db.models import Trip, Day, User


class _Block(SimpleNamespace):
    def model_dump(self): return self.__dict__


class _Resp:
    def __init__(self, content): self.content = content


class FakeAnthropic:
    def __init__(self, scripted: list[_Resp]):
        self._scripted = list(scripted)

    @property
    def messages(self):
        return self

    async def create(self, **kwargs):
        return self._scripted.pop(0)


async def test_agent_adds_place_via_fake_llm(db_session):
    user = User(email="x@y.ru", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    trip = Trip(user_id=user.id, destination="Казань", interests=["culture"])
    trip.days.append(Day(day_number=1))
    db_session.add(trip)
    await db_session.commit()

    script = [
        _Resp([
            _Block(type="tool_use", id="t1", name="search_place",
                   input={"query": "Казанский Кремль", "near_city": "Казань"}),
        ]),
        _Resp([
            _Block(type="tool_use", id="t2", name="add_place",
                   input={"day_number": 1, "name": "Казанский Кремль", "lat": 55.7989, "lon": 49.1057, "duration_minutes": 120}),
        ]),
        _Resp([_Block(type="text", text="Готово!")]),
    ]

    # monkeypatch search_place via runner import path
    from app.agent import tools
    async def fake_search(q, near_city=None, limit=5):
        return [{"name": q, "lat": 55.7989, "lon": 49.1057, "address": "Казань", "category": "historic"}]
    tools.search_places = fake_search  # type: ignore

    events = []
    async for ev in run_agent(db_session, trip, "Сделай план на день 1", client=FakeAnthropic(script)):
        events.append(ev)

    kinds = [e["type"] for e in events]
    assert "tool_call" in kinds
    assert kinds[-1] == "done"
    snap = await snapshot_trip(db_session, trip.id)
    assert any(p["name"] == "Казанский Кремль" for d in snap["days"] for p in d["places"])
```

- [ ] **Step 5: Run + commit**

Run: `.venv/bin/pytest tests/test_agent.py -q` → pass.

```bash
git add backend/app/agent backend/tests/test_agent.py
git commit -m "feat(backend): Haiku 4.5 agent runner with tool-loop + snapshots"
```

---

### Task 12: SSE messages endpoint

**Files:**
- Create: `backend/app/api/messages.py`
- Create: `backend/tests/test_messages.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: `backend/app/api/messages.py`**

```python
import json
import uuid
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sse_starlette.sse import EventSourceResponse

from app.agent.runner import run_agent
from app.api.deps import current_user
from app.db.models import Day, Event, Trip, User
from app.db.session import get_db

router = APIRouter(prefix="/api/trips", tags=["messages"])


@router.post("/{trip_id}/messages")
async def post_message(
    trip_id: uuid.UUID,
    body: dict = Body(...),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = (await db.execute(
        select(Trip).options(selectinload(Trip.days).selectinload(Day.places)).where(Trip.id == trip_id)
    )).scalar_one_or_none()
    if not trip or trip.user_id != user.id:
        raise HTTPException(404, "Trip not found")

    text = str(body.get("text", "")).strip()
    if not text:
        raise HTTPException(400, "empty message")

    db.add(Event(user_id=user.id, type="message_sent", props={"trip_id": str(trip.id)}))
    await db.commit()

    async def generator():
        async for ev in run_agent(db, trip, text):
            yield {"event": ev["type"], "data": json.dumps(ev, ensure_ascii=False, default=str)}

    return EventSourceResponse(generator())
```

- [ ] **Step 2: Mount in `main.py`**

`from app.api.messages import router as messages_router; app.include_router(messages_router)`.

- [ ] **Step 3: `backend/tests/test_messages.py`** — smoke test (agent mocked)

```python
import json

import pytest

from app.agent import runner as runner_mod


class FakeAnthropic:
    async def close(self): ...

    @property
    def messages(self): return self

    async def create(self, **kwargs):
        class Block:
            def __init__(self, **kw):
                self.__dict__.update(kw)
                if "type" not in kw: self.type = "text"
            def model_dump(self): return {**self.__dict__}
        class Resp:
            content = [Block(type="text", text="OK")]
        return Resp()


async def test_sse_flow(client, monkeypatch):
    monkeypatch.setattr(runner_mod, "build_client", lambda: FakeAnthropic())

    ck = (await client.post("/api/auth/signup", json={"email": "m@t.ru", "password": "secret1"})).cookies
    r = await client.post("/api/trips", json={"destination": "Москва"}, cookies=ck)
    trip_id = r.json()["id"]

    r = await client.post(f"/api/trips/{trip_id}/messages", json={"text": "Привет"}, cookies=ck)
    assert r.status_code == 200
    body = r.text
    assert "done" in body
```

- [ ] **Step 4: Run + commit**

Run: `.venv/bin/pytest tests/test_messages.py -q` → pass.

```bash
git add backend/app/api/messages.py backend/tests/test_messages.py backend/app/main.py
git commit -m "feat(backend): SSE message endpoint with agent streaming"
```

---

### Task 13: Admin stats + funnel

**Files:**
- Create: `backend/app/api/admin.py`
- Create: `backend/tests/test_admin.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: `backend/app/api/admin.py`**

```python
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import admin_user
from app.db.models import Event, Trip, User
from app.db.session import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"])

FUNNEL_STEPS = ["page_view", "signup", "trip_created", "message_sent", "trip_shared"]


@router.get("/stats")
async def stats(
    days: int = Query(14, ge=1, le=90),
    _: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(tz=timezone.utc) - timedelta(days=days)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()
    total_trips = (await db.execute(select(func.count()).select_from(Trip))).scalar()

    day_col = func.date_trunc("day", Event.created_at)
    events_per_day_rows = (await db.execute(
        select(day_col.label("d"), Event.type, func.count())
        .where(Event.created_at >= since)
        .group_by("d", Event.type)
        .order_by("d")
    )).all()

    by_day: dict[str, dict] = {}
    for d, typ, c in events_per_day_rows:
        key = d.isoformat()
        by_day.setdefault(key, {"date": key})
        by_day[key][typ] = c

    top_dest = (await db.execute(
        select(Trip.destination, func.count()).group_by(Trip.destination).order_by(func.count().desc()).limit(10)
    )).all()

    return {
        "totals": {"users": total_users, "trips": total_trips},
        "by_day": list(by_day.values()),
        "top_destinations": [{"destination": d, "count": c} for d, c in top_dest],
    }


@router.get("/funnel")
async def funnel(
    _: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
):
    rows = []
    for step in FUNNEL_STEPS:
        n = (await db.execute(select(func.count()).select_from(Event).where(Event.type == step))).scalar()
        rows.append({"step": step, "count": n})
    return {"steps": rows}
```

- [ ] **Step 2: Mount + test**

```python
async def test_admin_requires_admin(client):
    ck = (await client.post("/api/auth/signup", json={"email": "u@x.ru", "password": "secret1"})).cookies
    r = await client.get("/api/admin/stats", cookies=ck)
    assert r.status_code == 403


async def test_admin_stats_ok(client, db_session):
    from app.db.models import User
    from app.core.security import hash_password
    from sqlalchemy import select

    # Create admin via direct DB insert
    u = User(email="admin@x.ru", password_hash=hash_password("secret1"), is_admin=True)
    db_session.add(u); await db_session.commit()

    ck = (await client.post("/api/auth/login", json={"email": "admin@x.ru", "password": "secret1"})).cookies
    r = await client.get("/api/admin/stats", cookies=ck)
    assert r.status_code == 200
    assert "totals" in r.json()

    r2 = await client.get("/api/admin/funnel", cookies=ck)
    assert r2.status_code == 200
    assert len(r2.json()["steps"]) == 5
```

- [ ] **Step 3: Mount, run, commit**

Add `from app.api.admin import router as admin_router; app.include_router(admin_router)`.

Run: `.venv/bin/pytest tests/test_admin.py -q` → pass.

```bash
git add backend/app/api/admin.py backend/tests/test_admin.py backend/app/main.py
git commit -m "feat(backend): admin stats and funnel endpoints"
```

---

### Task 14: STT endpoint (Whisper fallback)

**Files:**
- Create: `backend/app/api/stt.py`
- Create: `backend/app/services/stt.py`
- Create: `backend/tests/test_stt.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: `backend/app/services/stt.py`**

```python
from functools import lru_cache
from pathlib import Path
from app.core.config import get_settings

settings = get_settings()


@lru_cache
def _load_model():
    if not settings.USE_WHISPER:
        return None
    from faster_whisper import WhisperModel  # type: ignore
    return WhisperModel(settings.STT_MODEL, device="cpu", compute_type="int8")


async def transcribe(path: Path, language: str = "ru") -> str:
    model = _load_model()
    if model is None:
        raise RuntimeError("Whisper disabled (USE_WHISPER=false)")
    segments, _ = model.transcribe(str(path), language=language, vad_filter=True)
    return " ".join(s.text.strip() for s in segments).strip()
```

- [ ] **Step 2: `backend/app/api/stt.py`**

```python
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.api.deps import current_user
from app.core.config import get_settings
from app.services.stt import transcribe

router = APIRouter(prefix="/api/stt", tags=["stt"])
settings = get_settings()


@router.post("")
async def stt(audio: UploadFile = File(...), _user=Depends(current_user)):
    if not settings.USE_WHISPER:
        raise HTTPException(503, "Whisper disabled on this deployment")
    suffix = Path(audio.filename or "audio.webm").suffix or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        path = Path(tmp.name)
    try:
        text = await transcribe(path)
    finally:
        path.unlink(missing_ok=True)
    return {"text": text}
```

- [ ] **Step 3: `backend/tests/test_stt.py`** — skip if disabled

```python
import os, pytest

pytestmark = pytest.mark.skipif(os.getenv("SKIP_STT_TEST"), reason="stt heavy")


async def test_stt_disabled_returns_503(client, monkeypatch):
    monkeypatch.setenv("USE_WHISPER", "false")
    # reimport settings cache
    from app.core.config import get_settings
    get_settings.cache_clear()
    ck = (await client.post("/api/auth/signup", json={"email": "v@v.ru", "password": "secret1"})).cookies
    r = await client.post("/api/stt", files={"audio": ("a.webm", b"0", "audio/webm")}, cookies=ck)
    assert r.status_code in (503, 500)
```

- [ ] **Step 4: Mount, run, commit**

Add router to `main.py`. Run: `SKIP_STT_TEST=1 .venv/bin/pytest tests/test_stt.py -q` → skipped.

```bash
git add backend/app/api/stt.py backend/app/services/stt.py backend/tests/test_stt.py backend/app/main.py
git commit -m "feat(backend): STT endpoint with faster-whisper fallback"
```

---

### Task 15: Telegram bot integration

**Files:**
- Create: `backend/app/bot/__init__.py`
- Create: `backend/app/bot/main.py`
- Create: `backend/app/bot/handlers.py`
- Create: `backend/app/api/telegram.py` (link code issuance)
- Create: `backend/tests/test_telegram_link.py`

- [ ] **Step 1: `backend/app/api/telegram.py`**

```python
import secrets
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.post("/link")
async def issue_link_code(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    code = secrets.token_urlsafe(6)[:8].upper()
    user.telegram_link_code = code
    await db.commit()
    return {"code": code, "deep_link": f"https://t.me/your_bot_username?start={code}"}


@router.get("/status")
async def link_status(user: User = Depends(current_user)):
    return {"linked": user.telegram_user_id is not None}
```

- [ ] **Step 2: `backend/app/bot/handlers.py`**

```python
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker
from telegram import Update
from telegram.ext import ContextTypes

from app.agent.runner import run_agent
from app.db.models import Day, Trip, User
from app.db.session import engine
from sqlalchemy.orm import selectinload


def _make_session():
    return async_sessionmaker(engine, expire_on_commit=False)()


async def _find_user_by_tg(tg_id: int) -> User | None:
    async with _make_session() as db:
        return (await db.execute(select(User).where(User.telegram_user_id == tg_id))).scalar_one_or_none()


async def cmd_start(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    args = _ctx.args if _ctx else update.message.text.split()[1:]
    if args:
        code = args[0]
        async with _make_session() as db:
            user = (await db.execute(select(User).where(User.telegram_link_code == code))).scalar_one_or_none()
            if user:
                user.telegram_user_id = update.effective_user.id
                user.telegram_link_code = None
                await db.commit()
                await update.message.reply_text(f"Аккаунт привязан, {user.display_name or user.email}. Напишите /new_trip")
                return
    await update.message.reply_text(
        "Привет! Я Travel Buddy. Откройте сайт, сгенерируйте код на странице настроек Telegram и пришлите /link <код>."
    )


async def cmd_link(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    if not _ctx.args:
        await update.message.reply_text("Пришлите: /link КОД")
        return
    code = _ctx.args[0]
    async with _make_session() as db:
        user = (await db.execute(select(User).where(User.telegram_link_code == code))).scalar_one_or_none()
        if not user:
            await update.message.reply_text("Код не подошёл.")
            return
        user.telegram_user_id = update.effective_user.id
        user.telegram_link_code = None
        await db.commit()
        await update.message.reply_text("Готово, аккаунт привязан.")


async def cmd_help(update: Update, _):
    await update.message.reply_text("/start, /link КОД, /new_trip <город> <N дней>, /trips, или просто напишите что-то")


async def cmd_new_trip(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    user = await _find_user_by_tg(update.effective_user.id)
    if not user:
        await update.message.reply_text("Привяжите аккаунт через /link")
        return
    parts = (update.message.text or "").split(maxsplit=2)
    destination = parts[1] if len(parts) > 1 else "Казань"
    async with _make_session() as db:
        trip = Trip(user_id=user.id, destination=destination, interests=[])
        trip.days.append(Day(day_number=1))
        db.add(trip)
        await db.commit()
        await db.refresh(trip)
    await update.message.reply_text(f"Создал поездку в {destination}. Что вам интересно?")


async def on_text(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    user = await _find_user_by_tg(update.effective_user.id)
    if not user:
        await update.message.reply_text("Привяжите аккаунт: /link КОД")
        return
    async with _make_session() as db:
        trip = (await db.execute(
            select(Trip).options(selectinload(Trip.days).selectinload(Day.places)).where(Trip.user_id == user.id).order_by(Trip.created_at.desc())
        )).scalars().first()
        if not trip:
            trip = Trip(user_id=user.id, destination="Россия")
            trip.days.append(Day(day_number=1))
            db.add(trip)
            await db.flush()

        await update.message.chat.send_action("typing")
        text_reply = []
        async for ev in run_agent(db, trip, update.message.text or ""):
            if ev["type"] == "token":
                text_reply.append(ev["text"])
            elif ev["type"] == "tool_call":
                await update.message.reply_text(f"🔧 {ev['name']}")
        if text_reply:
            await update.message.reply_text("".join(text_reply)[:4000])


async def cmd_trips(update: Update, _):
    user = await _find_user_by_tg(update.effective_user.id)
    if not user:
        await update.message.reply_text("Привяжите аккаунт через /link")
        return
    async with _make_session() as db:
        trips = (await db.execute(
            select(Trip).where(Trip.user_id == user.id).order_by(Trip.created_at.desc()).limit(10)
        )).scalars().all()
    if not trips:
        await update.message.reply_text("Пока нет поездок.")
        return
    lines = [f"• {t.destination} ({t.created_at:%Y-%m-%d})" for t in trips]
    await update.message.reply_text("\n".join(lines))
```

- [ ] **Step 3: `backend/app/bot/main.py`**

```python
import logging
from telegram.ext import Application, CommandHandler, MessageHandler, filters

from app.core.config import get_settings
from app.bot.handlers import cmd_start, cmd_link, cmd_help, cmd_new_trip, cmd_trips, on_text

logging.basicConfig(level=logging.INFO)
settings = get_settings()


def build_app() -> Application:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise SystemExit("TELEGRAM_BOT_TOKEN is empty")
    app = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("new_trip", cmd_new_trip))
    app.add_handler(CommandHandler("trips", cmd_trips))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    return app


def main():
    build_app().run_polling(close_loop=False)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: `backend/tests/test_telegram_link.py`** (tests API, not the bot process)

```python
async def test_link_code_roundtrip(client):
    ck = (await client.post("/api/auth/signup", json={"email": "tg@x.ru", "password": "secret1"})).cookies
    r = await client.post("/api/telegram/link", cookies=ck)
    assert r.status_code == 200
    assert len(r.json()["code"]) >= 6

    r2 = await client.get("/api/telegram/status", cookies=ck)
    assert r2.status_code == 200
    assert r2.json()["linked"] is False
```

- [ ] **Step 5: Mount + commit**

Mount `app.api.telegram.router` in main.py.

Run: `.venv/bin/pytest tests/test_telegram_link.py -q` → pass.

```bash
git add backend/app/bot backend/app/api/telegram.py backend/tests/test_telegram_link.py backend/app/main.py
git commit -m "feat(backend): telegram bot with link flow + /new_trip /trips handlers"
```

---

## PHASE 3 — Frontend

### Task 16: API client, auth store, analytics SDK, voice hook

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/api/trips.ts`
- Create: `frontend/src/api/admin.ts`
- Create: `frontend/src/store/authStore.ts`
- Create: `frontend/src/store/uiStore.ts`
- Create: `frontend/src/lib/analytics.ts`
- Create: `frontend/src/lib/speech.ts`
- Create: `frontend/src/lib/sse.ts`
- Create: `frontend/src/hooks/useVoiceInput.ts`

- [ ] **Step 1: `frontend/src/api/client.ts`**

```ts
import axios from "axios";
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});
```

- [ ] **Step 2: `frontend/src/api/auth.ts`**

```ts
import { api } from "./client";

export type User = { id: string; email: string; display_name: string | null; is_admin: boolean };

export const signup = (body: { email: string; password: string; display_name?: string }) =>
  api.post<User>("/auth/signup", body).then((r) => r.data);
export const login = (body: { email: string; password: string }) =>
  api.post<User>("/auth/login", body).then((r) => r.data);
export const logout = () => api.post("/auth/logout").then((r) => r.data);
export const me = () => api.get<User>("/auth/me").then((r) => r.data);
```

- [ ] **Step 3: `frontend/src/api/trips.ts`**

```ts
import { api } from "./client";

export type Place = {
  id: string; order_index: number; name: string; description: string | null;
  category: string | null; lat: number; lon: number; address: string | null;
  duration_minutes: number | null;
};
export type Day = { id: string; day_number: number; date: string | null; title: string | null; places: Place[] };
export type Trip = {
  id: string; title: string | null; destination: string; start_date: string | null; end_date: string | null;
  travelers: number; interests: string[]; summary: string | null; is_public: boolean; days: Day[];
  created_at: string; updated_at: string;
};
export type TripSummary = { id: string; title: string | null; destination: string; start_date: string | null; end_date: string | null; created_at: string; is_public: boolean };

export const createTrip = (body: { destination: string; start_date?: string; end_date?: string; travelers?: number; interests?: string[]; title?: string }) =>
  api.post<Trip>("/trips", body).then((r) => r.data);
export const listTrips = () => api.get<TripSummary[]>("/trips").then((r) => r.data);
export const getTrip = (id: string) => api.get<Trip>(`/trips/${id}`).then((r) => r.data);
export const patchTrip = (id: string, body: Partial<{ title: string; is_public: boolean }>) =>
  api.patch<Trip>(`/trips/${id}`, body).then((r) => r.data);
export const deleteTrip = (id: string) => api.delete(`/trips/${id}`).then((r) => r.data);
export const publicTrip = (id: string) => api.get<Trip>(`/public/trips/${id}`).then((r) => r.data);
```

- [ ] **Step 4: `frontend/src/api/admin.ts`**

```ts
import { api } from "./client";
export const getStats = (days = 14) => api.get(`/admin/stats?days=${days}`).then((r) => r.data);
export const getFunnel = () => api.get(`/admin/funnel`).then((r) => r.data);
```

- [ ] **Step 5: `frontend/src/store/authStore.ts`**

```ts
import { create } from "zustand";
import { me, type User } from "../api/auth";

type State = {
  user: User | null;
  loading: boolean;
  load: () => Promise<void>;
  set: (u: User | null) => void;
};

export const useAuth = create<State>((set) => ({
  user: null,
  loading: true,
  load: async () => {
    set({ loading: true });
    try {
      const user = await me();
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  set: (u) => set({ user: u }),
}));
```

- [ ] **Step 6: `frontend/src/store/uiStore.ts`**

```ts
import { create } from "zustand";

type State = {
  selectedDay: number | null; // null = all days
  setSelectedDay: (d: number | null) => void;
};

export const useUi = create<State>((set) => ({
  selectedDay: null,
  setSelectedDay: (d) => set({ selectedDay: d }),
}));
```

- [ ] **Step 7: `frontend/src/lib/analytics.ts`**

```ts
import { api } from "../api/client";

const KEY = "tb_session";
function sessionId(): string {
  let s = localStorage.getItem(KEY);
  if (!s) { s = crypto.randomUUID(); localStorage.setItem(KEY, s); }
  return s;
}

export function track(type: string, props: Record<string, unknown> = {}) {
  api.post("/events", { type, props, session_id: sessionId() }).catch(() => {});
}
```

- [ ] **Step 8: `frontend/src/lib/speech.ts`**

```ts
// Thin wrapper around Web Speech API with ru-RU
export function supportsSpeech(): boolean {
  return typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
}

export function createRecognition(lang = "ru-RU") {
  const Ctor: any =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  return rec;
}
```

- [ ] **Step 9: `frontend/src/hooks/useVoiceInput.ts`**

```ts
import { useRef, useState } from "react";
import { createRecognition, supportsSpeech } from "../lib/speech";

export function useVoiceInput(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const ref = useRef<any>(null);

  const start = () => {
    const rec = createRecognition();
    if (!rec) return;
    ref.current = rec;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript as string;
      onText(t);
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  };

  const stop = () => { ref.current?.stop(); setListening(false); };

  return { supported: supportsSpeech(), listening, start, stop };
}
```

- [ ] **Step 10: `frontend/src/lib/sse.ts`** (fetch-based SSE reader for POST)

```ts
export type SseEvent = { event: string; data: any };

export async function* streamPostSse(url: string, body: any): AsyncGenerator<SseEvent> {
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.body) return;
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const chunk of parts) {
      const lines = chunk.split("\n");
      let ev = "message";
      let dataStr = "";
      for (const ln of lines) {
        if (ln.startsWith("event:")) ev = ln.slice(6).trim();
        else if (ln.startsWith("data:")) dataStr += ln.slice(5).trim();
      }
      if (dataStr) {
        try { yield { event: ev, data: JSON.parse(dataStr) }; }
        catch { yield { event: ev, data: dataStr }; }
      }
    }
  }
}
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/api frontend/src/store frontend/src/lib frontend/src/hooks
git commit -m "feat(frontend): API client, auth/ui stores, analytics, voice, SSE lib"
```

---

### Task 17: Landing page (via `frontend-design` skill)

**Files:**
- Create: `frontend/src/pages/LandingPage.tsx`
- Create: `frontend/src/components/landing/Hero.tsx`
- Create: `frontend/src/components/landing/Features.tsx`
- Create: `frontend/src/components/landing/CTA.tsx`
- Modify: `frontend/src/App.tsx` (route `/` → `LandingPage`)

- [ ] **Step 1: Invoke `frontend-design` skill**

Prompt outline to hand the skill:
> Design a landing page for "Travel Buddy RU" — AI trip planner for Russia. Russian-language visitors; 2026 travel-product aesthetic; not generic. Hero: animated map silhouette of Russia, trip pins lighting up day-by-day; big CTA "Спланировать поездку". Features row (4): AI-агент с RAG; карты с маркерами по дням; голосовой ввод; Telegram-бот. Social-proof ribbon of Russian city names. Warm color palette anchored on `brand-500` (#f97316) on a near-white background with subtle dark accents. Deliver React + Tailwind components, no external icon packs beyond `lucide-react` (we can add).

Accept the output. If it introduces new deps (e.g. `lucide-react`), `npm i` them.

- [ ] **Step 2: Integrate into route**

Edit `frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* existing placeholders remain */}
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Track `page_view` on landing mount**

In `LandingPage.tsx`:

```tsx
useEffect(() => { track("page_view", { path: "/" }); }, []);
```

- [ ] **Step 4: Verify in browser**

Run frontend dev server; open `http://localhost:5173/`; confirm the designed page renders without console errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): landing page (via frontend-design skill)"
```

---

### Task 18: Login and Signup pages

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/SignupPage.tsx`
- Create: `frontend/src/components/AuthCard.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Invoke `frontend-design` skill** for the auth card component.

Prompt:
> Design login and signup forms for Travel Buddy RU. Two pages sharing one `AuthCard` component. Consistent with landing's palette. Large typography for headings, friendly copy in Russian. Split-screen option: left card, right hero illustration. Form validation inline (email format, password min length). Call-to-action buttons in `brand-500`.

- [ ] **Step 2: Wire form submit to API**

In `LoginPage.tsx`:

```tsx
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { useAuth } from "../store/authStore";
import { track } from "../lib/analytics";
// ...
const setUser = useAuth((s) => s.set);
const navigate = useNavigate();
const onSubmit = async (email: string, password: string) => {
  const user = await login({ email, password });
  setUser(user);
  track("login", {});
  navigate("/app/trips");
};
```

In `SignupPage.tsx` — same shape but `signup()`; emit `track("signup", {})`.

- [ ] **Step 3: Mount routes**

```tsx
<Route path="/login" element={<LoginPage />} />
<Route path="/signup" element={<SignupPage />} />
```

- [ ] **Step 4: Verify flows manually + commit**

Signup → cookie set → redirect `/app/trips`. Login likewise.

```bash
git add frontend/
git commit -m "feat(frontend): login and signup pages"
```

---

### Task 19: App shell + trips list + new-trip form

**Files:**
- Create: `frontend/src/pages/AppLayout.tsx`
- Create: `frontend/src/pages/TripsPage.tsx`
- Create: `frontend/src/components/NewTripForm.tsx`
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: `ProtectedRoute.tsx`**

```tsx
import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../store/authStore";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, load } = useAuth();
  useEffect(() => { if (!user && loading) load(); }, [user, loading, load]);
  if (loading) return <div className="p-8">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 2: `AppLayout.tsx`** — top bar with nav, user email, "Выйти"

```tsx
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../store/authStore";
import { logout } from "../api/auth";

export default function AppLayout() {
  const { user, set } = useAuth();
  const nav = useNavigate();
  const doLogout = async () => { await logout(); set(null); nav("/"); };
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <Link to="/app/trips" className="font-display text-xl">Travel Buddy RU</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/app/trips">Мои поездки</Link>
          <Link to="/app/settings/telegram">Telegram</Link>
          {user?.is_admin && <Link to="/app/admin">Admin</Link>}
          <span className="text-ink-500">{user?.email}</span>
          <button onClick={doLogout} className="text-brand-600 hover:underline">Выйти</button>
        </nav>
      </header>
      <main className="p-0"><Outlet /></main>
    </div>
  );
}
```

- [ ] **Step 3: `NewTripForm.tsx`** — invoke `frontend-design` for the form aesthetic.

The form collects destination, dates, travelers, checkboxes for interests. On submit: `createTrip(...)`, `track("trip_created", { destination })`, navigate to `/app/trips/:id`.

- [ ] **Step 4: `TripsPage.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listTrips } from "../api/trips";
import NewTripForm from "../components/NewTripForm";

export default function TripsPage() {
  const { data } = useQuery({ queryKey: ["trips"], queryFn: listTrips });
  return (
    <div className="max-w-5xl mx-auto p-8 grid md:grid-cols-[1fr_2fr] gap-8">
      <section className="bg-white rounded-2xl shadow-glass p-6">
        <h2 className="font-display text-2xl mb-4">Новая поездка</h2>
        <NewTripForm />
      </section>
      <section>
        <h2 className="font-display text-2xl mb-4">Мои поездки</h2>
        <ul className="space-y-3">
          {data?.map((t) => (
            <li key={t.id} className="bg-white rounded-xl p-4 shadow-sm">
              <Link className="font-medium text-lg" to={`/app/trips/${t.id}`}>{t.destination}</Link>
              <div className="text-ink-500 text-sm">{t.start_date} — {t.end_date}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Wire routes**

```tsx
<Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
  <Route index element={<Navigate to="trips" replace />} />
  <Route path="trips" element={<TripsPage />} />
  {/* trip detail in later task */}
</Route>
```

- [ ] **Step 6: Verify + commit**

Create a trip from UI, see it in the list.

```bash
git add frontend/
git commit -m "feat(frontend): app shell, trips list, new-trip form"
```

---

### Task 20: Trip page layout (via `frontend-design` skill)

**Files:**
- Create: `frontend/src/pages/TripPage.tsx` (integrates MapView, Itinerary, ChatPanel — see next tasks)
- Create: `frontend/src/components/DaySelector.tsx`

- [ ] **Step 1: Invoke `frontend-design` skill**

Prompt:
> Design the Trip page for Travel Buddy RU. We have three functional areas: a large map (primary focus), a day-by-day itinerary list, and a chat pane. Avoid the default "chat on left, map on right" layout — give the map primacy (fills the right 2/3 of the screen) with the itinerary overlapping the map on the left bottom in a glass card, and chat pinned to a floating composer at the bottom. Include a horizontal day selector chip row above the map. Responsive: on mobile, tabs between Map / Itinerary / Chat. Palette consistent with prior pages.

- [ ] **Step 2: Wire day selector**

`DaySelector.tsx` reads/writes `useUi.selectedDay` and receives `days` prop. Keyboard support: digits 1–9 call `setSelectedDay(n)`; `0` sets `null` (all days).

- [ ] **Step 3: Commit (structural)**

```bash
git add frontend/src/pages/TripPage.tsx frontend/src/components/DaySelector.tsx
git commit -m "feat(frontend): trip page shell and day selector"
```

---

### Task 21: MapView component

**Files:**
- Create: `frontend/src/components/MapView.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Day, Place } from "../api/trips";
import { useUi } from "../store/uiStore";

const dayColors = ["#f97316", "#2563eb", "#059669", "#dc2626", "#7c3aed", "#d97706", "#db2777"];

function icon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(points as any, { padding: [32, 32] });
  }, [points, map]);
  return null;
}

export default function MapView({ days }: { days: Day[] }) {
  const selected = useUi((s) => s.selectedDay);
  const visibleDays = selected == null ? days : days.filter((d) => d.day_number === selected);
  const all: { d: Day; p: Place; color: string }[] = useMemo(
    () => visibleDays.flatMap((d) => d.places.map((p) => ({ d, p, color: dayColors[(d.day_number - 1) % dayColors.length] }))),
    [visibleDays],
  );
  const points: [number, number][] = all.map((x) => [x.p.lat, x.p.lon]);

  return (
    <MapContainer className="h-full w-full" center={[55.75, 37.62]} zoom={5} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {visibleDays.map((d) => (
        <Polyline
          key={d.id}
          positions={d.places.map((p) => [p.lat, p.lon])}
          pathOptions={{ color: dayColors[(d.day_number - 1) % dayColors.length], weight: 4, opacity: 0.7 }}
        />
      ))}
      {all.map(({ d, p, color }) => (
        <Marker key={p.id} position={[p.lat, p.lon]} icon={icon(color)}>
          <Popup>
            <div className="text-sm font-medium">День {d.day_number}: {p.name}</div>
            {p.description && <div className="text-xs text-ink-500 mt-1">{p.description}</div>}
          </Popup>
        </Marker>
      ))}
      <FitBounds points={points} />
    </MapContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/MapView.tsx
git commit -m "feat(frontend): leaflet map with day-colored markers and polylines"
```

---

### Task 22: Chat panel with SSE + voice

**Files:**
- Create: `frontend/src/components/ChatPanel.tsx`
- Create: `frontend/src/components/VoiceButton.tsx`
- Create: `frontend/src/components/Itinerary.tsx`
- Integrate in: `frontend/src/pages/TripPage.tsx`

- [ ] **Step 1: `VoiceButton.tsx`**

```tsx
import { Mic, MicOff } from "lucide-react";
import { useVoiceInput } from "../hooks/useVoiceInput";

export default function VoiceButton({ onTranscript }: { onTranscript: (t: string) => void }) {
  const { supported, listening, start, stop } = useVoiceInput(onTranscript);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      aria-pressed={listening}
      className={`rounded-full p-2 border transition ${listening ? "bg-brand-500 text-white" : "bg-white"}`}
      title={listening ? "Идёт запись" : "Голосовой ввод"}
    >
      {listening ? <MicOff size={18}/> : <Mic size={18}/>}
    </button>
  );
}
```

- [ ] **Step 2: `ChatPanel.tsx`**

```tsx
import { useRef, useState } from "react";
import { streamPostSse } from "../lib/sse";
import VoiceButton from "./VoiceButton";
import { track } from "../lib/analytics";

type Props = { tripId: string; onState: (trip: any) => void };

export default function ChatPanel({ tripId, onState }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ role: "user" | "assistant" | "tool"; text: string }[]>([]);
  const streamBuf = useRef("");

  const send = async (msg: string) => {
    if (!msg.trim()) return;
    setLog((l) => [...l, { role: "user", text: msg }, { role: "assistant", text: "" }]);
    setBusy(true);
    track("message_sent", { trip_id: tripId });
    streamBuf.current = "";
    try {
      for await (const ev of streamPostSse(`/api/trips/${tripId}/messages`, { text: msg })) {
        if (ev.event === "token") {
          streamBuf.current += ev.data.text;
          setLog((l) => {
            const copy = [...l];
            copy[copy.length - 1] = { role: "assistant", text: streamBuf.current };
            return copy;
          });
        } else if (ev.event === "tool_call") {
          setLog((l) => [...l, { role: "tool", text: `🔧 ${ev.data.name}` }, { role: "assistant", text: "" }]);
          streamBuf.current = "";
        } else if (ev.event === "state") {
          onState(ev.data.trip);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl shadow-glass p-4 w-full max-w-2xl mx-auto">
      <div className="max-h-64 overflow-y-auto space-y-2 mb-3 text-sm">
        {log.map((m, i) => (
          <div key={i} className={
            m.role === "user" ? "text-right" :
            m.role === "tool" ? "text-ink-500 text-xs" : ""
          }>
            {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); const v = text; setText(""); send(v); }} className="flex gap-2 items-center">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Скажите, куда хотите поехать..."
          className="flex-1 border rounded-full px-4 py-2"
          disabled={busy}
        />
        <VoiceButton onTranscript={(t) => { setText(t); send(t); }} />
        <button className="bg-brand-500 text-white rounded-full px-4 py-2 disabled:opacity-50" disabled={busy}>
          Отправить
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: `Itinerary.tsx`**

```tsx
import type { Trip } from "../api/trips";
import { useUi } from "../store/uiStore";

export default function Itinerary({ trip }: { trip: Trip }) {
  const selected = useUi((s) => s.selectedDay);
  const days = selected == null ? trip.days : trip.days.filter((d) => d.day_number === selected);
  return (
    <div className="space-y-4">
      {trip.summary && <p className="text-sm text-ink-700">{trip.summary}</p>}
      {days.map((d) => (
        <section key={d.id} className="bg-white/90 rounded-xl p-4 shadow-sm">
          <h3 className="font-display text-lg">День {d.day_number}{d.title ? `: ${d.title}` : ""}</h3>
          <ol className="mt-2 space-y-2 list-decimal list-inside text-sm">
            {d.places.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.name}</span>
                {p.duration_minutes ? <span className="text-ink-500"> · {p.duration_minutes} мин</span> : null}
                {p.description && <div className="text-xs text-ink-500">{p.description}</div>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Integrate in `TripPage.tsx`**

```tsx
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getTrip } from "../api/trips";
import MapView from "../components/MapView";
import Itinerary from "../components/Itinerary";
import ChatPanel from "../components/ChatPanel";
import DaySelector from "../components/DaySelector";

export default function TripPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: trip } = useQuery({ queryKey: ["trip", id], queryFn: () => getTrip(id!), enabled: !!id });

  if (!trip) return <div className="p-8">Загрузка...</div>;

  return (
    <div className="relative h-[calc(100vh-64px)]">
      <div className="absolute inset-0"><MapView days={trip.days} /></div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20"><DaySelector days={trip.days} /></div>
      <div className="absolute top-20 left-6 bottom-32 w-[360px] z-20 overflow-y-auto">
        <Itinerary trip={trip} />
      </div>
      <div className="absolute bottom-6 left-0 right-0 z-20 px-6">
        <ChatPanel tripId={trip.id} onState={(newTrip) => qc.setQueryData(["trip", id], newTrip)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Mount + commit**

```bash
git add frontend/
git commit -m "feat(frontend): chat panel with SSE + voice, itinerary, map integration"
```

---

### Task 23: Admin dashboard (via `frontend-design` skill)

**Files:**
- Create: `frontend/src/pages/AdminPage.tsx`
- Create: `frontend/src/components/admin/Funnel.tsx`
- Create: `frontend/src/components/admin/StatsChart.tsx`

- [ ] **Step 1: Invoke `frontend-design` skill**

Prompt:
> Design an admin dashboard for Travel Buddy RU. KPI row at top: Users, Trips, Messages, Shares (big numbers, small trend indicator). Below: a line chart of daily events for the last 14 days (stacked by type: signup, trip_created, message_sent). Below that: a horizontal funnel visual (5 steps) with conversion percentages. Sidebar or top-right: a list of top 10 destinations. Tailwind + recharts. Palette same as rest.

- [ ] **Step 2: Implement `StatsChart.tsx`** with recharts `LineChart`.

- [ ] **Step 3: Implement `Funnel.tsx`** as a CSS-only horizontal bars.

- [ ] **Step 4: Fetch data**

```tsx
const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: () => getStats(14) });
const { data: funnel } = useQuery({ queryKey: ["admin-funnel"], queryFn: getFunnel });
```

- [ ] **Step 5: Route + commit**

```tsx
<Route path="admin" element={<AdminPage />} />
```

```bash
git add frontend/
git commit -m "feat(frontend): admin dashboard with KPIs, line chart, funnel"
```

---

### Task 24: Telegram settings page + Share-link copy

**Files:**
- Create: `frontend/src/pages/TelegramSettingsPage.tsx`
- Create: `frontend/src/api/telegram.ts`
- Modify: `frontend/src/pages/TripPage.tsx` (adds "Поделиться" button)

- [ ] **Step 1: `frontend/src/api/telegram.ts`**

```ts
import { api } from "./client";
export const issueLinkCode = () => api.post<{ code: string; deep_link: string }>("/telegram/link").then((r) => r.data);
export const linkStatus = () => api.get<{ linked: boolean }>("/telegram/status").then((r) => r.data);
```

- [ ] **Step 2: `TelegramSettingsPage.tsx`**

```tsx
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { issueLinkCode, linkStatus } from "../api/telegram";

export default function TelegramSettingsPage() {
  const status = useQuery({ queryKey: ["tg-status"], queryFn: linkStatus });
  const [payload, setPayload] = useState<{ code: string; deep_link: string } | null>(null);
  const issue = useMutation({ mutationFn: issueLinkCode, onSuccess: setPayload });

  return (
    <div className="max-w-xl mx-auto p-8 space-y-4">
      <h1 className="font-display text-2xl">Telegram</h1>
      <p className="text-ink-700">Привяжите аккаунт, чтобы планировать поездки прямо в Telegram.</p>
      <p>Статус: <strong>{status.data?.linked ? "Привязан" : "Не привязан"}</strong></p>
      <button onClick={() => issue.mutate()} className="bg-brand-500 text-white rounded-full px-4 py-2">Сгенерировать код</button>
      {payload && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-sm text-ink-500 mb-1">Ваш код:</div>
          <div className="font-mono text-2xl">{payload.code}</div>
          <div className="text-sm mt-2">В боте отправьте: <code>/link {payload.code}</code> или откройте <a className="text-brand-600 underline" href={payload.deep_link}>deep-link</a>.</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: "Поделиться" on TripPage**

In `TripPage.tsx`, add a small toolbar button that calls `patchTrip(id, { is_public: true })` then copies `${origin}/share/trips/${id}` to clipboard. Toast "Ссылка скопирована".

- [ ] **Step 4: Public share page**

Create `/src/pages/PublicTripPage.tsx` that calls `publicTrip(id)` (no auth) and renders a read-only map + itinerary. Add `<Route path="/share/trips/:id" element={<PublicTripPage/>}/>` outside of `/app` so it's accessible without login.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): telegram settings page and public share view"
```

---

## PHASE 4 — Integration, Verification, Docs

### Task 25: End-to-end verification via Chrome MCP

**Files:** none — verification only.

- [ ] **Step 1: Bring up services**

`docker compose up -d postgres`, then `make backend-dev` and `make frontend-dev` in separate shells. Load `.env` with a real `ANTHROPIC_API_KEY`.

- [ ] **Step 2: Use `mcp__Claude_in_Chrome__navigate` to open the app**

Navigate to `http://localhost:5173/`. Capture a screenshot and verify landing renders.

- [ ] **Step 3: Walk through signup**

Fill form, submit, verify redirect to `/app/trips`.

- [ ] **Step 4: Create a trip**

"Казань", `2026-06-01` → `2026-06-03`, interests `culture`, `food`. Submit.

- [ ] **Step 5: Observe agent progress**

On trip page, observe chat stream: `kb_search` → `search_place` → `add_place` ×N. Verify markers appear on map.

- [ ] **Step 6: Toggle days**

Click "День 1" chip → only day 1 markers visible. Click "Все дни" → all. Press `2` key → day 2 only.

- [ ] **Step 7: Remove a place via chat**

Send "Убери музей на втором дне". Verify marker disappears.

- [ ] **Step 8: Admin path**

Upgrade user in DB: `UPDATE users SET is_admin = true WHERE email='...'`. Reload. `/app/admin` renders charts.

- [ ] **Step 9: Report findings**

If any step fails, file a Task in this session to fix and re-run.

- [ ] **Step 10: No commit unless fixes made**

---

### Task 26: Top-level README polish

**Files:** `README.md`

- [ ] **Step 1: Expand README with feature list, screenshot placeholders, how-to-run**

Mention: Landing, Auth, Trip planner, Agent (Haiku 4.5), RAG over pgvector, Maps, Voice (Web Speech API), Telegram bot, Admin + Funnel, Analytics.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: expand README with full feature list and run steps"
```

---

## Self-review checklist (run after completing all tasks)

- [ ] Rubric criterion 1 (applied task) — trip planner → Tasks 8, 11, 12.
- [ ] Rubric 2 (vibe-coding) — this plan executed via Claude Code.
- [ ] Rubric 3 (LLM) — Task 11.
- [ ] Rubric 4 (Telegram bot) — Task 15.
- [ ] Rubric 5 (landing) — Task 17.
- [ ] Rubric 6 (web UI) — Tasks 17–24.
- [ ] Rubric 7 (auth) — Task 6.
- [ ] Rubric 8 (RAG) — Task 10; tool `kb_search` in Task 11.
- [ ] Rubric 9 (database) — Tasks 3, 4.
- [ ] Rubric 10 (STT) — Task 14 (backend) + Task 16/22 (frontend).
- [ ] Rubric 11 (usage dashboard) — Tasks 13, 23.
- [ ] Rubric 12 (funnel) — Task 13 `/admin/funnel` + Task 23 Funnel view + events emitted in Tasks 8, 12, 18, 24.

All rubric items map to at least one task.
