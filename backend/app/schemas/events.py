from __future__ import annotations

from pydantic import BaseModel, Field


class EventIn(BaseModel):
    type: str = Field(min_length=1, max_length=60)
    props: dict = Field(default_factory=dict)
    session_id: str | None = None
