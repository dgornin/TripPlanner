from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.auth import router as auth_router
from app.api.events import router as events_router
from app.api.messages import router as messages_router
from app.api.stt import router as stt_router
from app.api.telegram import router as telegram_router
from app.api.trips import public_router as public_trips_router
from app.api.trips import router as trips_router
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.SEED_RAG_ON_STARTUP:
        try:
            from app.rag.seed import seed_if_empty

            n = await seed_if_empty()
            if n:
                print(f"[lifespan] Seeded {n} KB chunks")
        except Exception as exc:  # noqa: BLE001
            print(f"[lifespan] RAG seed skipped: {exc}")
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Travel Buddy RU", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health() -> dict:
        return {"ok": True}

    app.include_router(auth_router)
    app.include_router(events_router)
    app.include_router(trips_router)
    app.include_router(public_trips_router)
    app.include_router(messages_router)
    app.include_router(admin_router)
    app.include_router(stt_router)
    app.include_router(telegram_router)

    return app


app = create_app()
