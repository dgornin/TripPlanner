from __future__ import annotations

import uuid
from typing import AsyncIterator

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain.agents import create_agent
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompt import SYSTEM_PROMPT
from app.agent.tools import (
    TOOLS,
    reset_agent_context,
    set_agent_context,
    snapshot_trip,
)
from app.core.config import get_settings
from app.db.models import Message, Trip

settings = get_settings()

MODEL_NAME = "claude-haiku-4-5-20251001"
RECURSION_LIMIT = 25  # ~ each agent step = one LLM call or tool call pair


def build_llm() -> BaseChatModel:
    return ChatAnthropic(
        model=MODEL_NAME,
        api_key=settings.ANTHROPIC_API_KEY,
        max_tokens=1500,
        temperature=0.3,
    )


# Cache one graph per LLM instance — construction is cheap but re-used per run.
def build_graph(llm: BaseChatModel):
    return create_agent(model=llm, tools=TOOLS)


def _serialize_message(m: BaseMessage) -> dict:
    """Best-effort serialization of a LangChain BaseMessage for DB storage."""
    role_map = {
        "human": "user",
        "ai": "assistant",
        "tool": "tool",
        "system": "system",
    }
    role = role_map.get(m.type, "assistant")
    data: dict = {"type": m.type, "content": m.content}
    if isinstance(m, AIMessage) and getattr(m, "tool_calls", None):
        data["tool_calls"] = [
            {"name": tc.get("name"), "args": tc.get("args"), "id": tc.get("id")}
            for tc in m.tool_calls
        ]
    if isinstance(m, ToolMessage):
        data["tool_call_id"] = m.tool_call_id
        data["name"] = getattr(m, "name", None)
    return {"role": role, "payload": data}


async def _load_history(db: AsyncSession, trip_id: uuid.UUID) -> list[BaseMessage]:
    rows = (
        await db.execute(
            select(Message).where(Message.trip_id == trip_id).order_by(Message.created_at)
        )
    ).scalars().all()
    out: list[BaseMessage] = []
    for row in rows:
        payload = row.content.get("payload") if isinstance(row.content, dict) else None
        if not payload:
            continue
        msg_type = payload.get("type")
        content = payload.get("content") or ""
        if msg_type == "human":
            out.append(HumanMessage(content=content))
        elif msg_type == "ai":
            tc = payload.get("tool_calls") or []
            out.append(AIMessage(content=content, tool_calls=tc) if tc else AIMessage(content=content))
        elif msg_type == "tool":
            out.append(
                ToolMessage(
                    content=content,
                    tool_call_id=payload.get("tool_call_id", ""),
                    name=payload.get("name"),
                )
            )
    return out


async def run_agent(
    db: AsyncSession,
    trip: Trip,
    user_text: str,
    llm: BaseChatModel | None = None,
) -> AsyncIterator[dict]:
    """Stream events from the LangGraph ReAct agent as simple dicts:
      {"type": "token",     "text": str}
      {"type": "tool_call", "name": str, "input": dict}
      {"type": "tool_result","name": str, "output": Any}
      {"type": "state",     "trip": dict}
      {"type": "done"}       | {"type": "error", "error": str}
    """
    llm = llm or build_llm()
    graph = build_graph(llm)

    # Persist the user message before running.
    user_msg = HumanMessage(content=user_text)
    db.add(
        Message(
            trip_id=trip.id,
            role="user",
            content={"role": "user", "payload": {"type": "human", "content": user_text}},
        )
    )
    await db.commit()

    # Build message list: system + prior history + new user.
    acc_bits: list[str] = []
    if trip.accommodation:
        acc_bits.append(f"место проживания: \"{trip.accommodation}\"")
        if trip.accommodation_lat is not None and trip.accommodation_lon is not None:
            acc_bits.append(
                f"координаты жилья: lat={trip.accommodation_lat:.5f}, "
                f"lon={trip.accommodation_lon:.5f}"
            )
            acc_bits.append(
                "Выстраивай порядок точек в дне так, чтобы маршрут начинался "
                "рядом с жильём и возвращался к нему — меньше лишних перемещений."
            )
    ctx_note = (
        f"Контекст поездки: город={trip.destination}, "
        f"интересы={list(trip.interests or [])}, дней={len(trip.days)}."
    )
    if acc_bits:
        ctx_note += "\n" + " ".join(acc_bits)
    history = await _load_history(db, trip.id)
    messages: list[BaseMessage] = [
        SystemMessage(content=SYSTEM_PROMPT + "\n\n" + ctx_note),
        *history,
    ]
    # history already includes the new user message we just persisted
    if not history or not isinstance(history[-1], HumanMessage):
        messages.append(user_msg)

    tokens = set_agent_context(trip.id)
    try:
        final_state: dict | None = None
        seen_ids: set[str] = set()
        async for event in graph.astream_events(
            {"messages": messages},
            config={"recursion_limit": RECURSION_LIMIT},
            version="v2",
        ):
            kind = event.get("event")
            data = event.get("data", {})

            if kind == "on_chat_model_stream":
                chunk = data.get("chunk")
                if chunk is None:
                    continue
                text = getattr(chunk, "content", "")
                # content may be a list of content blocks (Anthropic)
                if isinstance(text, list):
                    for block in text:
                        if isinstance(block, dict) and block.get("type") == "text":
                            piece = block.get("text", "")
                            if piece:
                                yield {"type": "token", "text": piece}
                elif isinstance(text, str) and text:
                    yield {"type": "token", "text": text}

            elif kind == "on_tool_start":
                tid = event.get("run_id") or event.get("name")
                if tid in seen_ids:
                    continue
                seen_ids.add(tid)
                yield {
                    "type": "tool_call",
                    "name": event.get("name"),
                    "input": data.get("input") or {},
                }

            elif kind == "on_tool_end":
                tool_name = event.get("name")
                yield {
                    "type": "tool_result",
                    "name": tool_name,
                    "output": _safe_tool_output(data.get("output")),
                }
                # For mutating tools, push an incremental state snapshot so
                # the UI updates live as places are added.
                if tool_name in {
                    "add_place",
                    "remove_place",
                    "update_place",
                    "set_trip_summary",
                    "set_day_title",
                }:
                    try:
                        from app.db.session import SessionLocal

                        async with SessionLocal() as fresh:
                            yield {
                                "type": "state",
                                "trip": await snapshot_trip(fresh, trip.id),
                            }
                    except Exception:  # noqa: BLE001
                        pass

            elif kind == "on_chain_end" and event.get("name") in {"LangGraph", "agent"}:
                final_state = data.get("output") or data.get("outputs")
    except Exception as exc:  # noqa: BLE001
        yield {"type": "error", "error": str(exc)}
        return
    finally:
        reset_agent_context(tokens)

    # Persist full message history (assistant + tool) to DB.
    if final_state and isinstance(final_state, dict):
        out_messages = final_state.get("messages") or []
        new_msgs = out_messages[len(history):]
        for m in new_msgs:
            if isinstance(m, HumanMessage):
                continue  # already persisted
            wrapped = _serialize_message(m)
            db.add(Message(trip_id=trip.id, role=wrapped["role"], content=wrapped))
        await db.commit()

    # Final snapshot uses a fresh session because the shared `db` session
    # may have a cached view that pre-dates the per-tool commits.
    from app.db.session import SessionLocal as _Fresh

    async with _Fresh() as fresh:
        yield {"type": "state", "trip": await snapshot_trip(fresh, trip.id)}
    yield {"type": "done"}


def _safe_tool_output(output) -> object:
    """Best-effort JSON-safe representation of a tool output."""
    try:
        import json

        json.dumps(output, ensure_ascii=False, default=str)
        return output
    except (TypeError, ValueError):
        return str(output)
