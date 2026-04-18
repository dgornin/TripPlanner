"""Agent test using a fake LangChain ChatModel.

We can't easily mock real Anthropic API calls without hitting the network, so we
inject a `FakeToolCallingModel` that speaks the LangChain BaseChatModel protocol
and returns scripted AIMessages (with or without tool calls). The ReAct graph
from LangGraph consumes them just like it would consume real Anthropic outputs.
"""

from __future__ import annotations

from typing import Any

from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage

from app.agent import tools as tools_mod
from app.agent.runner import run_agent
from app.agent.tools import snapshot_trip
from app.db.models import Day, Trip, User


class _ToolCallingFake(FakeMessagesListChatModel):
    """Fake chat model that pretends to support tool binding."""

    def bind_tools(self, tools, **_kwargs):  # noqa: ARG002
        return self


def _fake_llm(messages: list[AIMessage]) -> Any:
    return _ToolCallingFake(responses=messages)


async def test_agent_adds_place_via_fake_llm(db_session, monkeypatch):
    user = User(email="x@y.ru", password_hash="x")
    db_session.add(user)
    await db_session.flush()
    trip = Trip(user_id=user.id, destination="Казань", interests=["culture"])
    trip.days.append(Day(day_number=1))
    db_session.add(trip)
    await db_session.commit()

    async def fake_search(query, near_city=None, limit=5):
        return [
            {
                "name": query,
                "lat": 55.7989,
                "lon": 49.1057,
                "address": "Казань",
                "category": "historic",
            }
        ]

    monkeypatch.setattr(tools_mod.geocoding, "search_places", fake_search)

    scripted = [
        AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "search_place",
                    "args": {"query": "Казанский Кремль", "near_city": "Казань"},
                    "id": "tool_1",
                }
            ],
        ),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "add_place",
                    "args": {
                        "day_number": 1,
                        "name": "Казанский Кремль",
                        "lat": 55.7989,
                        "lon": 49.1057,
                        "duration_minutes": 120,
                    },
                    "id": "tool_2",
                }
            ],
        ),
        AIMessage(content="Готово!"),
    ]

    events = []
    async for ev in run_agent(db_session, trip, "Спланируй день 1", llm=_fake_llm(scripted)):
        events.append(ev)

    kinds = [e["type"] for e in events]
    # Surface error text if the agent aborted, for easier debugging.
    errors = [e for e in events if e["type"] == "error"]
    assert not errors, f"agent errored: {errors}"
    assert "tool_call" in kinds
    assert kinds[-1] == "done"
    snap = await snapshot_trip(db_session, trip.id)
    assert any(p["name"] == "Казанский Кремль" for d in snap["days"] for p in d["places"])
