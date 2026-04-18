from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import selectinload
from telegram import Update
from telegram.ext import ContextTypes

from app.agent.runner import run_agent
from app.db.models import Day, Trip, User
from app.db.session import engine


def _make_session_maker():
    return async_sessionmaker(engine, expire_on_commit=False)


async def _find_user_by_tg(tg_id: int) -> User | None:
    Session = _make_session_maker()
    async with Session() as db:
        return (
            await db.execute(select(User).where(User.telegram_user_id == tg_id))
        ).scalar_one_or_none()


async def _link_by_code(tg_id: int, code: str) -> User | None:
    Session = _make_session_maker()
    async with Session() as db:
        user = (
            await db.execute(select(User).where(User.telegram_link_code == code))
        ).scalar_one_or_none()
        if not user:
            return None
        user.telegram_user_id = tg_id
        user.telegram_link_code = None
        await db.commit()
        return user


async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    args = ctx.args if ctx and ctx.args else []
    if args:
        user = await _link_by_code(update.effective_user.id, args[0])
        if user:
            await update.message.reply_text(
                f"Готово, аккаунт {user.email} привязан. Напишите мне, куда хотите поехать — "
                "или используйте /new_trip."
            )
            return
    await update.message.reply_text(
        "Привет! Я Travel Buddy RU 🇷🇺\n\n"
        "Откройте сайт, сгенерируйте код в настройках Telegram "
        "и отправьте мне команду `/link КОД`. Потом напишите, куда хотите поехать."
    )


async def cmd_help(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Команды:\n"
        "/start — начало\n"
        "/link КОД — привязать аккаунт\n"
        "/new_trip город [N] — создать поездку (N дней, необязательно)\n"
        "/trips — мои поездки\n\n"
        "Или просто напишите, куда хотите поехать."
    )


async def cmd_link(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Пришлите: /link КОД")
        return
    user = await _link_by_code(update.effective_user.id, ctx.args[0])
    if not user:
        await update.message.reply_text("Код не подошёл.")
    else:
        await update.message.reply_text(f"Привязан аккаунт {user.email}.")


async def cmd_new_trip(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    user = await _find_user_by_tg(update.effective_user.id)
    if not user:
        await update.message.reply_text("Сначала привяжите аккаунт: /link КОД")
        return
    parts = (update.message.text or "").split(maxsplit=2)
    destination = parts[1] if len(parts) > 1 else "Россия"
    Session = _make_session_maker()
    async with Session() as db:
        trip = Trip(user_id=user.id, destination=destination, interests=[])
        trip.days.append(Day(day_number=1))
        db.add(trip)
        await db.commit()
    await update.message.reply_text(
        f"Создал поездку в {destination}. Напишите, что вам интересно, и я составлю план."
    )


async def cmd_trips(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    user = await _find_user_by_tg(update.effective_user.id)
    if not user:
        await update.message.reply_text("Сначала привяжите аккаунт: /link КОД")
        return
    Session = _make_session_maker()
    async with Session() as db:
        trips = (
            await db.execute(
                select(Trip)
                .where(Trip.user_id == user.id)
                .order_by(Trip.created_at.desc())
                .limit(10)
            )
        ).scalars().all()
    if not trips:
        await update.message.reply_text("Пока нет поездок. Напишите мне город для старта.")
        return
    lines = [f"• {t.destination} ({t.created_at:%Y-%m-%d})" for t in trips]
    await update.message.reply_text("\n".join(lines))


async def on_text(update: Update, _ctx: ContextTypes.DEFAULT_TYPE):
    user = await _find_user_by_tg(update.effective_user.id)
    if not user:
        await update.message.reply_text("Сначала привяжите аккаунт: /link КОД")
        return

    Session = _make_session_maker()
    async with Session() as db:
        trip = (
            await db.execute(
                select(Trip)
                .options(selectinload(Trip.days).selectinload(Day.places))
                .where(Trip.user_id == user.id)
                .order_by(Trip.created_at.desc())
            )
        ).scalars().first()
        if not trip:
            trip = Trip(user_id=user.id, destination="Россия", interests=[])
            trip.days.append(Day(day_number=1))
            db.add(trip)
            await db.flush()

        await update.message.chat.send_action("typing")
        collected = []
        try:
            async for ev in run_agent(db, trip, update.message.text or ""):
                if ev["type"] == "token":
                    collected.append(ev["text"])
                elif ev["type"] == "tool_call":
                    await update.message.reply_text(f"🔧 {ev['name']}")
        except Exception as exc:  # noqa: BLE001
            await update.message.reply_text(f"Ошибка: {exc}")
            return

    if collected:
        text = "".join(collected).strip()
        # Telegram limit 4096
        for chunk in [text[i : i + 4000] for i in range(0, len(text), 4000)]:
            await update.message.reply_text(chunk)
