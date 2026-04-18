from sqlalchemy import select

from app.db.models import Event


async def test_event_logged(client, db_session):
    r = await client.post("/api/events", json={"type": "page_view", "props": {"path": "/"}})
    assert r.status_code == 200
    rows = (await db_session.execute(select(Event).where(Event.type == "page_view"))).scalars().all()
    assert len(rows) >= 1


async def test_event_with_session(client, db_session):
    r = await client.post(
        "/api/events",
        json={"type": "custom", "session_id": "abc", "props": {"a": 1}},
    )
    assert r.status_code == 200
    row = (
        await db_session.execute(select(Event).where(Event.session_id == "abc"))
    ).scalars().first()
    assert row is not None
    assert row.props == {"a": 1}
