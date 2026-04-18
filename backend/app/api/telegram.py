from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.core.config import get_settings
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/api/telegram", tags=["telegram"])
settings = get_settings()


@router.post("/link")
async def issue_link_code(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    code = secrets.token_urlsafe(6)[:8].upper().replace("_", "X").replace("-", "Y")
    user.telegram_link_code = code
    await db.commit()
    bot_username = settings.TELEGRAM_BOT_USERNAME or "your_bot"
    return {
        "code": code,
        "deep_link": f"https://t.me/{bot_username}?start={code}",
    }


@router.get("/status")
async def link_status(user: User = Depends(current_user)):
    return {"linked": user.telegram_user_id is not None}
