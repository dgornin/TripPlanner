from __future__ import annotations

import asyncio
import uuid
from contextvars import ContextVar
from typing import Any

from langchain_core.tools import tool
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.db.models import Day, Place, Trip
from app.db.session import engine
from app.rag.retriever import search_kb
from app.services import geocoding

# Serializes tools that mutate the DB per-trip so that parallel add_place
# tool calls (the agent often emits several at once) don't race on
# order_index. A single process-wide map of locks is fine for a dev SQLite
# / single-uvicorn setup; for multi-worker deployments, swap for an
# advisory DB lock on (trip_id).
_mutation_locks: dict[uuid.UUID, asyncio.Lock] = {}
_mutation_locks_guard = asyncio.Lock()


async def _lock_for(trip_id: uuid.UUID) -> asyncio.Lock:
    async with _mutation_locks_guard:
        lock = _mutation_locks.get(trip_id)
        if lock is None:
            lock = asyncio.Lock()
            _mutation_locks[trip_id] = lock
        return lock


# ---------------------------------------------------------------------------
# Context: the runner sets these before invoking the graph so each @tool call
# can reach the current Trip by id and open its own DB session. Using a
# session-per-tool (rather than a shared one) avoids concurrent-access errors
# when the agent dispatches tool calls in parallel.
# ---------------------------------------------------------------------------
_ctx_trip_id: ContextVar[uuid.UUID | None] = ContextVar("tb_trip_id", default=None)
_SessionMaker = async_sessionmaker(engine, expire_on_commit=False)


def set_agent_context(trip_id: uuid.UUID) -> tuple:
    """Install trip id into context for the duration of an agent run."""
    return (_ctx_trip_id.set(trip_id),)


def reset_agent_context(tokens: tuple) -> None:
    (trip_tok,) = tokens
    _ctx_trip_id.reset(trip_tok)


def _trip_id() -> uuid.UUID:
    tid = _ctx_trip_id.get()
    if tid is None:
        raise RuntimeError("Agent context not set — call set_agent_context first")
    return tid


async def _find_or_create_day(db: AsyncSession, trip_id: uuid.UUID, day_number: int) -> Day:
    day = (
        await db.execute(
            select(Day).where(Day.trip_id == trip_id, Day.day_number == day_number)
        )
    ).scalar_one_or_none()
    if day:
        return day
    day = Day(trip_id=trip_id, day_number=day_number)
    db.add(day)
    await db.flush()
    return day


# ---------------------------------------------------------------------------
# Tools — each opens a fresh AsyncSession, commits on success, closes on exit.
# ---------------------------------------------------------------------------
@tool
async def kb_search(query: str, city: str | None = None) -> list[dict]:
    """Search the internal knowledge base of Russian travel info.
    Use this FIRST to get real facts before recommending places.
    """
    async with _SessionMaker() as db:
        return await search_kb(db, query, city=city, k=5)


@tool
async def search_place(query: str, near_city: str) -> list[dict]:
    """Find a real place by name near a city and return candidates with
    lat/lon/address (OpenStreetMap/Nominatim). MUST be called before add_place.
    """
    return await geocoding.search_places(query, near_city=near_city, limit=5)


@tool
async def add_place(
    day_number: int,
    name: str,
    lat: float,
    lon: float,
    description: str | None = None,
    duration_minutes: int | None = None,
    category: str | None = None,
    address: str | None = None,
) -> dict:
    """Add a place with coordinates to the given day of the current trip.
    `lat`/`lon` MUST come from `search_place`. Returns the new place id.
    """
    tid = _trip_id()
    lock = await _lock_for(tid)
    async with lock:
        async with _SessionMaker() as db:
            day = await _find_or_create_day(db, tid, int(day_number))
            max_order = (
                await db.execute(
                    select(func.max(Place.order_index)).where(Place.day_id == day.id)
                )
            ).scalar()
            order_index = (max_order + 1) if max_order is not None else 0
            place = Place(
                day_id=day.id,
                order_index=order_index,
                name=name,
                description=description,
                lat=float(lat),
                lon=float(lon),
                duration_minutes=duration_minutes,
                category=category,
                address=address,
            )
            db.add(place)
            await db.commit()
            return {"place_id": str(place.id), "order_index": order_index}


@tool
async def remove_place(place_id: str) -> dict:
    """Remove a place from the trip by id."""
    try:
        pid = uuid.UUID(place_id)
    except ValueError:
        return {"ok": False, "error": "invalid place_id"}
    tid = _trip_id()
    lock = await _lock_for(tid)
    async with lock:
        async with _SessionMaker() as db:
            await db.execute(delete(Place).where(Place.id == pid))
            await db.commit()
    return {"ok": True}


@tool
async def update_place(place_id: str, fields: dict) -> dict:
    """Patch a place (description, duration_minutes, category, name)."""
    try:
        pid = uuid.UUID(place_id)
    except ValueError:
        return {"ok": False, "error": "invalid place_id"}
    tid = _trip_id()
    lock = await _lock_for(tid)
    async with lock:
        async with _SessionMaker() as db:
            place = (
                await db.execute(select(Place).where(Place.id == pid))
            ).scalar_one_or_none()
            if not place:
                return {"ok": False, "error": "not found"}
            for k, v in (fields or {}).items():
                if hasattr(place, k) and k not in {"id", "day_id", "order_index"}:
                    setattr(place, k, v)
            await db.commit()
    return {"ok": True}


@tool
async def set_trip_summary(summary: str) -> dict:
    """Set the trip-level summary paragraph shown on the trip page."""
    tid = _trip_id()
    lock = await _lock_for(tid)
    async with lock:
        async with _SessionMaker() as db:
            trip = (
                await db.execute(select(Trip).where(Trip.id == tid))
            ).scalar_one_or_none()
            if not trip:
                return {"ok": False, "error": "trip not found"}
            trip.summary = summary
            await db.commit()
    return {"ok": True}


@tool
async def set_day_title(day_number: int, title: str) -> dict:
    """Set the title for a specific day (e.g. 'День 1: Старый город')."""
    tid = _trip_id()
    lock = await _lock_for(tid)
    async with lock:
        async with _SessionMaker() as db:
            day = await _find_or_create_day(db, tid, int(day_number))
            day.title = title
            await db.commit()
    return {"ok": True}


TOOLS: list[Any] = [
    kb_search,
    search_place,
    add_place,
    remove_place,
    update_place,
    set_trip_summary,
    set_day_title,
]


# ---------------------------------------------------------------------------
# Trip snapshot — exposed to the runner for state events.
# ---------------------------------------------------------------------------
async def snapshot_trip(db: AsyncSession, trip_id: uuid.UUID) -> dict:
    from app.api.trips import trip_out

    trip = (
        await db.execute(
            select(Trip)
            .options(selectinload(Trip.days).selectinload(Day.places))
            .where(Trip.id == trip_id)
        )
    ).scalar_one()
    return trip_out(trip).model_dump(mode="json")
