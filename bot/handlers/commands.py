from __future__ import annotations

import logging

from telegram import Update
from telegram.ext import ContextTypes

from bot.users import register_or_update_user

log = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_user or not update.message:
        return

    u = update.effective_user
    pool = context.application.bot_data["db_pool"]

    is_new, user_id = await register_or_update_user(
        pool,
        telegram_id=u.id,
        username=u.username,
        first_name=u.first_name or "",
        last_name=u.last_name or "",
        language_code=u.language_code,
    )

    name = u.first_name or u.username or "друг"
    if is_new:
        text = (
            f"Привет, {name}.\n\n"
            "Ты зарегистрирован в боте. Внутренний id пользователя: "
            f"{user_id}. Дальше на этапе 3 здесь появятся анкеты и лента."
        )
    else:
        text = (
            f"С возвращением, {name}.\n\n"
            f"Твой аккаунт уже есть (id {user_id}). Профиль обновлён по данным Telegram."
        )

    await update.message.reply_text(text)
    log.info("start user telegram_id=%s internal_id=%s new=%s", u.id, user_id, is_new)


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    await update.message.reply_text(
        "Команды:\n"
        "/start — регистрация или обновление данных из Telegram\n"
        "/help — эта справка"
    )
