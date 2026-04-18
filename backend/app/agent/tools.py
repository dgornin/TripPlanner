from __future__ import annotations

import uuid
from contextvars import ContextVar
from typing import Any

from langchain_core.tools import tool
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Day, Place, Trip
from app.rag.retriever import search_kb
from app.services import geocoding


# ---------------------------------------------------------------------------
# Context: the agent runner sets these before invoking the graph, so each @tool
# implementation can reach the current SQLAlchemy session and active Trip without
# passing them through the LLM as arguments.
# ---------------------------------------------------------------------------
_ctx_session: ContextVar[AsyncSession | None] = ContextVar("tb_session", default=None)
_ctx_trip: ContextVar[Trip | None] = ContextVar("tb_trip", default=None)


def set_agent_context(session: AsyncSession, trip: Trip) -> tuple:
    """Install session+trip into context for the duration of an agent run.
    Returns tokens for later reset."""
    return (
        _ctx_session.set(session),
        _ctx_trip.set(trip),
    )


def reset_agent_context(tokens: tuple) -> None:
    session_tok, trip_tok = tokens
    _ctx_session.reset(session_tok)
    _ctx_trip.reset(trip_tok)


def _session() -> AsyncSession:
    s = _ctx_session.get()
    if s is None:
        raise RuntimeError("Agent context not set — call set_agent_context first")
    return s


def _trip() -> Trip:
    t = _ctx_trip.get()
    if t is None:
        raise RuntimeError("Agent context not set — call set_agent_context first")
    return t


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
# Tools
# ---------------------------------------------------------------------------
@tool
async def kb_search(query: str, city: str | None = None) -> list[dict]:
    """Search the internal knowledge base of Russian travel info.
    Use this FIRST to get real facts before recommending places.
    """
    return await search_kb(_session(), query, city=city, k=5)


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
    db = _session()
    trip = _trip()
    day = await _find_or_create_day(db, trip.id, int(day_number))
    existing = (await db.execute(select(Place).where(Place.day_id == day.id))).scalars().all()
    order_index = max((p.order_index for p in existing), default=-1) + 1
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
    await db.flush()
    return {"place_id": str(place.id), "order_index": order_index}


@tool
async def remove_place(place_id: str) -> dict:
    """Remove a place from the trip by id."""
    try:
        pid = uuid.UUID(place_id)
    except ValueError:
        return {"ok": False, "error": "invalid place_id"}
    await _session().execute(delete(Place).where(Place.id == pid))
    return {"ok": True}


@tool
async def update_place(place_id: str, fields: dict) -> dict:
    """Patch a place (description, duration_minutes, category, name)."""
    try:
        pid = uuid.UUID(place_id)
    except ValueError:
        return {"ok": False, "error": "invalid place_id"}
    db = _session()
    place = (await db.execute(select(Place).where(Place.id == pid))).scalar_one_or_none()
    if not place:
        return {"ok": False, "error": "not found"}
    for k, v in (fields or {}).items():
        if hasattr(place, k) and k not in {"id", "day_id", "order_index"}:
            setattr(place, k, v)
    return {"ok": True}


@tool
async def set_trip_summary(summary: str) -> dict:
    """Set the trip-level summary paragraph shown on the trip page."""
    _trip().summary = summary
    return {"ok": True}


@tool
async def set_day_title(day_number: int, title: str) -> dict:
    """Set the title for a specific day (e.g. 'Day 1: Old town')."""
    db = _session()
    day = await _find_or_create_day(db, _trip().id, int(day_number))
    day.title = title
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
