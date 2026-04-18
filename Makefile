SHELL := /bin/bash
.DEFAULT_GOAL := help

# Detect compose command (podman compose / docker compose / docker-compose)
COMPOSE := $(shell command -v podman >/dev/null 2>&1 && echo "podman compose" || (command -v docker >/dev/null 2>&1 && echo "docker compose" || echo "docker-compose"))

help:
	@echo "Travel Buddy RU — make targets"
	@echo ""
	@echo "  install         install backend (venv) + frontend (npm) deps"
	@echo "  up              bring up full stack via compose ($(COMPOSE))"
	@echo "  down            stop the stack"
	@echo "  dev             local dev: compose pg + backend + frontend"
	@echo "  backend-dev     run uvicorn in backend venv"
	@echo "  frontend-dev    run vite"
	@echo "  bot-dev         run telegram bot worker"
	@echo "  migrate         alembic upgrade head"
	@echo "  seed-rag        populate kb_chunks from backend/data/kb_russia.jsonl"
	@echo "  test            backend pytest + frontend vitest"
	@echo "  lint            ruff + eslint"
	@echo "  fmt             ruff format + prettier"

PYTHON ?= $(shell command -v python3.11 >/dev/null 2>&1 && echo python3.11 || echo python3)

install:
	cd backend && $(PYTHON) -m venv .venv && .venv/bin/pip install --upgrade pip && .venv/bin/pip install -e ".[dev]"
	cd frontend && npm install

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

up-postgres:
	$(COMPOSE) up -d postgres

dev: up-postgres
	@echo "Start backend-dev and frontend-dev in separate shells (or bot-dev)."

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
