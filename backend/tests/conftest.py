from __future__ import annotations

import asyncio
import os
import uuid
from typing import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.base import Base
from app.db import models  # noqa: F401 — register models
from app.db.session import get_db
from app.main import app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def engine():
    settings = get_settings()
    dbname = f"tb_test_{uuid.uuid4().hex[:8]}"
    admin_url = settings.DATABASE_URL.rsplit("/", 1)[0] + "/postgres"

    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as c:
        await c.exec_driver_sql(f'CREATE DATABASE "{dbname}"')
    await admin_engine.dispose()

    test_url = settings.DATABASE_URL.rsplit("/", 1)[0] + f"/{dbname}"
    e = create_async_engine(test_url)
    async with e.begin() as conn:
        await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.run_sync(Base.metadata.create_all)
    yield e
    await e.dispose()

    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as c:
        await c.exec_driver_sql(f'DROP DATABASE "{dbname}" WITH (FORCE)')
    await admin_engine.dispose()


@pytest.fixture
async def db_session(engine) -> AsyncIterator:
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as s:
        try:
            yield s
        finally:
            await s.rollback()


@pytest.fixture
async def client(engine) -> AsyncIterator[AsyncClient]:
    maker = async_sessionmaker(engine, expire_on_commit=False)

    async def override_db():
        async with maker() as s:
            yield s

    app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="session", autouse=True)
def _set_test_env():
    os.environ.setdefault("JWT_SECRET", "test-secret")
    yield
