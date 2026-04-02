from __future__ import annotations

from psycopg_pool import AsyncConnectionPool


def _trunc(s: str | None, max_len: int) -> str:
    if not s:
        return ""
    return s[:max_len]


async def register_or_update_user(
    pool: AsyncConnectionPool,
    *,
    telegram_id: int,
    username: str | None,
    first_name: str,
    last_name: str,
    language_code: str | None,
) -> tuple[bool, int]:
    """
    Upsert user by telegram_id. Returns (is_new, internal_user_id).
    is_new is True if the row did not exist before this call.
    """
    uname: str | None
    if username:
        uname = _trunc(username.lower(), 32) or None
    else:
        uname = None
    fn = _trunc(first_name, 128)
    ln = _trunc(last_name, 128)
    lang = _trunc(language_code, 16) or None

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT id FROM users WHERE telegram_id = %s",
                (telegram_id,),
            )
            row = await cur.fetchone()
            existed = row is not None

            await cur.execute(
                """
                INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (telegram_id) DO UPDATE SET
                    username = EXCLUDED.username,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    language_code = EXCLUDED.language_code,
                    updated_at = now()
                RETURNING id
                """,
                (telegram_id, uname, fn, ln, lang),
            )
            out = await cur.fetchone()
            if not out:
                raise RuntimeError("upsert user failed")
            user_id = int(out[0])
        await conn.commit()

    return (not existed, user_id)
