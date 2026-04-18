from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import COOKIE_NAME, current_user
from app.core.config import get_settings
from app.core.security import hash_password, make_access_token, verify_password
from app.db.models import Event, User
from app.db.session import get_db
from app.schemas.auth import LoginIn, SignupIn, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _set_cookie(resp: Response, token: str) -> None:
    resp.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=settings.JWT_EXP_HOURS * 3600,
        path="/",
    )


def _to_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        is_admin=user.is_admin,
    )


@router.post("/signup", response_model=UserOut)
async def signup(body: SignupIn, resp: Response, db: AsyncSession = Depends(get_db)):
    exists = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "Email already registered")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.flush()
    db.add(Event(user_id=user.id, type="signup", props={"email": body.email}))
    await db.commit()
    await db.refresh(user)
    _set_cookie(resp, make_access_token(str(user.id), user.is_admin))
    return _to_out(user)


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, resp: Response, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    db.add(Event(user_id=user.id, type="login", props={}))
    await db.commit()
    _set_cookie(resp, make_access_token(str(user.id), user.is_admin))
    return _to_out(user)


@router.post("/logout")
async def logout(resp: Response):
    resp.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)):
    return _to_out(user)
