from __future__ import annotations

from fastapi import Cookie, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db

COOKIE_NAME = "access_token"


async def current_user(
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Cookie(default=None, alias=COOKIE_NAME),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = (
        await db.execute(select(User).where(User.id == payload["sub"]))
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def admin_user(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user
