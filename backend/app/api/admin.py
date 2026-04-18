from __future__ import annotations

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

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    total_trips = (await db.execute(select(func.count()).select_from(Trip))).scalar() or 0
    total_messages = (
        await db.execute(
            select(func.count()).select_from(Event).where(Event.type == "message_sent")
        )
    ).scalar() or 0
    total_shares = (
        await db.execute(
            select(func.count()).select_from(Event).where(Event.type == "trip_shared")
        )
    ).scalar() or 0

    day_col = func.date_trunc("day", Event.created_at)
    rows = (
        await db.execute(
            select(day_col.label("d"), Event.type, func.count())
            .where(Event.created_at >= since)
            .group_by("d", Event.type)
            .order_by("d")
        )
    ).all()

    by_day: dict[str, dict] = {}
    for d, typ, c in rows:
        key = d.isoformat() if hasattr(d, "isoformat") else str(d)
        by_day.setdefault(key, {"date": key})
        by_day[key][typ] = c

    top_dest = (
        await db.execute(
            select(Trip.destination, func.count())
            .group_by(Trip.destination)
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()

    return {
        "totals": {
            "users": total_users,
            "trips": total_trips,
            "messages": total_messages,
            "shares": total_shares,
        },
        "by_day": list(by_day.values()),
        "top_destinations": [{"destination": d, "count": c} for d, c in top_dest],
    }


@router.get("/funnel")
async def funnel(
    _: User = Depends(admin_user), db: AsyncSession = Depends(get_db)
):
    steps = []
    for step in FUNNEL_STEPS:
        n = (
            await db.execute(
                select(func.count()).select_from(Event).where(Event.type == step)
            )
        ).scalar() or 0
        steps.append({"step": step, "count": n})
    return {"steps": steps}
