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
    builder = Application.builder().token(settings.TELEGRAM_BOT_TOKEN)
    # Route Telegram API traffic through a proxy when TELEGRAM_PROXY_URL is
    # set. Both the main bot client and the long-poll getUpdates client need
    # their own proxy kwarg — Telegram is being throttled in some regions,
    # so we want the same outbound hop used for Anthropic.
    if settings.TELEGRAM_PROXY_URL:
        logging.info("Telegram proxy enabled: %s", _mask(settings.TELEGRAM_PROXY_URL))
        builder = builder.proxy(settings.TELEGRAM_PROXY_URL).get_updates_proxy(
            settings.TELEGRAM_PROXY_URL
        )
    app = builder.build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("link", cmd_link))
    app.add_handler(CommandHandler("new_trip", cmd_new_trip))
    app.add_handler(CommandHandler("trips", cmd_trips))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))
    return app


def _mask(url: str) -> str:
    """Hide basic-auth creds from logs — url is user:pass@host:port."""
    try:
        from urllib.parse import urlparse

        p = urlparse(url)
        host = p.hostname or "?"
        port = f":{p.port}" if p.port else ""
        return f"{p.scheme}://***@{host}{port}"
    except Exception:  # noqa: BLE001
        return "***"


def main():
    build_app().run_polling(close_loop=False)


if __name__ == "__main__":
    main()
