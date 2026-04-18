async def test_signup_login_logout_me(client):
    r = await client.post(
        "/api/auth/signup",
        json={"email": "a@b.ru", "password": "secret1", "display_name": "A"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == "a@b.ru"
    assert body["display_name"] == "A"
    assert "access_token" in r.cookies

    r2 = await client.get("/api/auth/me", cookies=r.cookies)
    assert r2.status_code == 200
    assert r2.json()["email"] == "a@b.ru"

    r3 = await client.post("/api/auth/logout", cookies=r.cookies)
    assert r3.status_code == 200

    r4 = await client.post(
        "/api/auth/login", json={"email": "a@b.ru", "password": "secret1"}
    )
    assert r4.status_code == 200
    assert "access_token" in r4.cookies


async def test_signup_conflict(client):
    await client.post("/api/auth/signup", json={"email": "b@b.ru", "password": "secret1"})
    r = await client.post("/api/auth/signup", json={"email": "b@b.ru", "password": "secret1"})
    assert r.status_code == 409


async def test_login_bad_password(client):
    await client.post("/api/auth/signup", json={"email": "c@b.ru", "password": "secret1"})
    r = await client.post("/api/auth/login", json={"email": "c@b.ru", "password": "wrong"})
    assert r.status_code == 401


async def test_me_requires_auth(client):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401
