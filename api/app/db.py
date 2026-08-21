"""asyncpg connection pool for the Honeypot SOC API.

The DSN is assembled from config.Settings (environment-driven). The pool is
created lazily on first use and closed explicitly on application shutdown.
Only parameterized SQL is used anywhere in the codebase.
"""

import asyncpg

from . import config

_pool: asyncpg.Pool | None = None


def get_dsn(cfg=None) -> str:
    c = cfg or config.settings
    return (
        f"postgresql://{c.postgres_user}:{c.postgres_password}"
        f"@{c.postgres_host}:{c.postgres_port}/{c.postgres_db}"
    )


async def create_pool(cfg=None, min_size=1, max_size=10) -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            get_dsn(cfg), min_size=min_size, max_size=max_size
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def pool() -> asyncpg.Pool | None:
    return _pool


async def get_conn():
    """FastAPI dependency: yield a connection from the shared pool."""
    p = await create_pool()
    async with p.acquire() as conn:
        yield conn