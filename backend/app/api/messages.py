from __future__ import annotations

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
    trip = (
        await db.execute(
            select(Trip)
            .options(selectinload(Trip.days).selectinload(Day.places))
            .where(Trip.id == trip_id)
        )
    ).scalar_one_or_none()
    if not trip or trip.user_id != user.id:
        raise HTTPException(404, "Trip not found")

    text = str(body.get("text", "")).strip()
    if not text:
        raise HTTPException(400, "empty message")

    db.add(Event(user_id=user.id, type="message_sent", props={"trip_id": str(trip.id)}))
    await db.commit()

    async def generator():
        async for ev in run_agent(db, trip, text):
            yield {
                "event": ev["type"],
                "data": json.dumps(ev, ensure_ascii=False, default=str),
            }

    return EventSourceResponse(generator())
