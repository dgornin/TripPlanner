from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, Field


class PlaceOut(BaseModel):
    id: str
    order_index: int
    name: str
    description: str | None = None
    category: str | None = None
    lat: float
    lon: float
    address: str | None = None
    duration_minutes: int | None = None


class DayOut(BaseModel):
    id: str
    day_number: int
    date: dt.date | None = None
    title: str | None = None
    places: list[PlaceOut] = Field(default_factory=list)


class TripBase(BaseModel):
    title: str | None = None
    destination: str = Field(min_length=1, max_length=200)
    start_date: dt.date | None = None
    end_date: dt.date | None = None
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
    start_date: dt.date | None
    end_date: dt.date | None
    created_at: dt.datetime
    is_public: bool


class TripOut(TripBase):
    id: str
    summary: str | None = None
    is_public: bool
    days: list[DayOut] = Field(default_factory=list)
    created_at: dt.datetime
    updated_at: dt.datetime
