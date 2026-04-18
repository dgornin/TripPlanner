from app.core.security import hash_password
from app.db.models import User


async def test_admin_requires_admin(client):
    cookies = (
        await client.post(
            "/api/auth/signup", json={"email": "u@x.ru", "password": "secret1"}
        )
    ).cookies
    r = await client.get("/api/admin/stats", cookies=cookies)
    assert r.status_code == 403


async def test_admin_stats_and_funnel(client, db_session):
    u = User(
        email="admin@x.ru",
        password_hash=hash_password("secret1"),
        is_admin=True,
    )
    db_session.add(u)
    await db_session.commit()

    cookies = (
        await client.post(
            "/api/auth/login", json={"email": "admin@x.ru", "password": "secret1"}
        )
    ).cookies
    r = await client.get("/api/admin/stats", cookies=cookies)
    assert r.status_code == 200
    body = r.json()
    assert "totals" in body
    assert "by_day" in body

    r = await client.get("/api/admin/funnel", cookies=cookies)
    assert r.status_code == 200
    assert len(r.json()["steps"]) == 5
