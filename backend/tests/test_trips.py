async def _signup(client, email="t@t.ru"):
    r = await client.post(
        "/api/auth/signup", json={"email": email, "password": "secret1"}
    )
    return r.cookies


async def test_trip_crud_and_share(client):
    cookies = await _signup(client)
    r = await client.post(
        "/api/trips",
        json={
            "destination": "Казань",
            "start_date": "2026-05-01",
            "end_date": "2026-05-03",
            "interests": ["culture", "food"],
        },
        cookies=cookies,
    )
    assert r.status_code == 200, r.text
    trip = r.json()
    assert trip["destination"] == "Казань"
    assert len(trip["days"]) == 3
    trip_id = trip["id"]

    r = await client.get("/api/trips", cookies=cookies)
    assert r.status_code == 200
    assert any(t["id"] == trip_id for t in r.json())

    r = await client.patch(
        f"/api/trips/{trip_id}", json={"is_public": True}, cookies=cookies
    )
    assert r.status_code == 200
    assert r.json()["is_public"] is True

    r = await client.get(f"/api/public/trips/{trip_id}")
    assert r.status_code == 200

    r = await client.delete(f"/api/trips/{trip_id}", cookies=cookies)
    assert r.status_code == 200


async def test_trip_requires_auth(client):
    r = await client.post("/api/trips", json={"destination": "Казань"})
    assert r.status_code == 401


async def test_public_private_404(client):
    cookies = await _signup(client, "priv@t.ru")
    r = await client.post("/api/trips", json={"destination": "Москва"}, cookies=cookies)
    trip_id = r.json()["id"]
    r = await client.get(f"/api/public/trips/{trip_id}")
    assert r.status_code == 404
