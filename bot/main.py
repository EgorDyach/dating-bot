from __future__ import annotations

import logging
import sys

from psycopg_pool import AsyncConnectionPool
from telegram import Update
from telegram.ext import Application, CommandHandler

from bot.config import bot_token, database_url
from bot.handlers.commands import help_cmd, start

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    level=logging.INFO,
)
log = logging.getLogger(__name__)


async def _post_init(app: Application) -> None:
    dsn = database_url()
    pool = AsyncConnectionPool(conninfo=dsn, min_size=1, max_size=10, open=False)
    await pool.open()
    app.bot_data["db_pool"] = pool
    log.info("database pool ready")


async def _post_shutdown(app: Application) -> None:
    pool = app.bot_data.get("db_pool")
    if pool is not None:
        await pool.close()
        log.info("database pool closed")


def main() -> None:
    app = (
        Application.builder()
        .token(bot_token())
        .post_init(_post_init)
        .post_shutdown(_post_shutdown)
        .build()
    )
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_cmd))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
