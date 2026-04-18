from __future__ import annotations

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
