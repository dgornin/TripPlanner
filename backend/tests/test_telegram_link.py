async def test_link_code_roundtrip(client):
    cookies = (
        await client.post(
            "/api/auth/signup", json={"email": "tg@x.ru", "password": "secret1"}
        )
    ).cookies
    r = await client.post("/api/telegram/link", cookies=cookies)
    assert r.status_code == 200
    data = r.json()
    assert len(data["code"]) >= 4
    assert "t.me/" in data["deep_link"]

    s = await client.get("/api/telegram/status", cookies=cookies)
    assert s.status_code == 200
    assert s.json()["linked"] is False
