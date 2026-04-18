from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import current_user
from app.db.models import Day, Event, Place, Trip, User
from app.db.session import get_db
from app.schemas.trips import (
    DayOut,
    PlaceOut,
    TripCreate,
    TripOut,
    TripPatch,
    TripSummary,
)

router = APIRouter(prefix="/api/trips", tags=["trips"])
public_router = APIRouter(prefix="/api/public", tags=["public"])


def _place_out(p: Place) -> PlaceOut:
    return PlaceOut(
        id=str(p.id),
        order_index=p.order_index,
        name=p.name,
        description=p.description,
        category=p.category,
        lat=p.lat,
        lon=p.lon,
        address=p.address,
        duration_minutes=p.duration_minutes,
    )


def _day_out(d: Day) -> DayOut:
    return DayOut(
        id=str(d.id),
        day_number=d.day_number,
        date=d.date,
        title=d.title,
        places=[_place_out(p) for p in d.places],
    )


def trip_out(t: Trip) -> TripOut:
    return TripOut(
        id=str(t.id),
        title=t.title,
        destination=t.destination,
        start_date=t.start_date,
        end_date=t.end_date,
        travelers=t.travelers,
        interests=list(t.interests or []),
        summary=t.summary,
        is_public=t.is_public,
        days=[_day_out(d) for d in t.days],
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


async def _load_full(db: AsyncSession, trip_id: uuid.UUID) -> Trip | None:
    return (
        await db.execute(
            select(Trip)
            .options(selectinload(Trip.days).selectinload(Day.places))
            .where(Trip.id == trip_id)
        )
    ).scalar_one_or_none()


@router.post("", response_model=TripOut)
async def create_trip(
    body: TripCreate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = Trip(
        user_id=user.id,
        title=body.title,
        destination=body.destination,
        start_date=body.start_date,
        end_date=body.end_date,
        travelers=body.travelers,
        interests=body.interests,
    )
    if body.start_date and body.end_date:
        n = (body.end_date - body.start_date).days + 1
        for i in range(n):
            trip.days.append(Day(day_number=i + 1))
    else:
        trip.days.append(Day(day_number=1))
    db.add(trip)
    await db.flush()
    db.add(
        Event(
            user_id=user.id,
            type="trip_created",
            props={"trip_id": str(trip.id), "destination": trip.destination},
        )
    )
    await db.commit()
    trip = await _load_full(db, trip.id)
    assert trip is not None
    return trip_out(trip)


@router.get("", response_model=list[TripSummary])
async def list_trips(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    rows = (
        await db.execute(
            select(Trip).where(Trip.user_id == user.id).order_by(Trip.created_at.desc())
        )
    ).scalars().all()
    return [
        TripSummary(
            id=str(t.id),
            title=t.title,
            destination=t.destination,
            start_date=t.start_date,
            end_date=t.end_date,
            created_at=t.created_at,
            is_public=t.is_public,
        )
        for t in rows
    ]


@router.get("/{trip_id}", response_model=TripOut)
async def get_trip(
    trip_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await _load_full(db, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(404, "Trip not found")
    return trip_out(trip)


@router.patch("/{trip_id}", response_model=TripOut)
async def patch_trip(
    trip_id: uuid.UUID,
    body: TripPatch,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = await _load_full(db, trip_id)
    if not trip or trip.user_id != user.id:
        raise HTTPException(404, "Trip not found")
    if body.title is not None:
        trip.title = body.title
    if body.is_public is not None:
        was_public = trip.is_public
        trip.is_public = body.is_public
        if body.is_public and not was_public:
            db.add(
                Event(
                    user_id=user.id,
                    type="trip_shared",
                    props={"trip_id": str(trip.id)},
                )
            )
    await db.commit()
    trip = await _load_full(db, trip_id)
    assert trip is not None
    return trip_out(trip)


@router.delete("/{trip_id}")
async def delete_trip(
    trip_id: uuid.UUID,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    trip = (await db.execute(select(Trip).where(Trip.id == trip_id))).scalar_one_or_none()
    if not trip or trip.user_id != user.id:
        raise HTTPException(404, "Trip not found")
    await db.delete(trip)
    await db.commit()
    return {"ok": True}


@public_router.get("/trips/{trip_id}", response_model=TripOut)
async def public_trip(trip_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    trip = await _load_full(db, trip_id)
    if not trip or not trip.is_public:
        raise HTTPException(404, "Trip not found")
    return trip_out(trip)
