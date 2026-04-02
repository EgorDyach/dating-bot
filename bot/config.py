import os

from dotenv import load_dotenv

load_dotenv()


def bot_token() -> str:
    t = os.environ.get("BOT_TOKEN", "").strip()
    if not t:
        raise RuntimeError("BOT_TOKEN is not set")
    return t


def database_url() -> str:
    u = os.environ.get("DATABASE_URL", "").strip()
    if not u:
        raise RuntimeError("DATABASE_URL is not set")
    return u
