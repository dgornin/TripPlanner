from __future__ import annotations

import logging

from telegram.ext import Application, CommandHandler, MessageHandler, filters

from app.bot.handlers import (
    cmd_help,
    cmd_link,
    cmd_new_trip,
    cmd_start,
    cmd_trips,
    on_text,
)
from app.core.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
settings = get_settings()


def build_app() -> Application:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise SystemExit("TELEGRAM_BOT_TOKEN is empty")
    app = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("new_trip", cmd_new_trip))
    app.add_handler(CommandHandler("trips", cmd_trips))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    return app


def main():
    build_app().run_polling(close_loop=False)


if __name__ == "__main__":
    main()
