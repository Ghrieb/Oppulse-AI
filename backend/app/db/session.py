"""The database engine and the session.

SQLite locally, Supabase Postgres in staging and production. The models are
written to be portable: nothing here uses a SQLite-only type, and the JSON
columns become ``JSONB`` when the dialect changes.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from ..config import get_settings


class Base(DeclarativeBase):
    """The declarative base."""


def create_engine() -> AsyncEngine:
    """The engine, for the configured database."""
    settings = get_settings()
    return create_async_engine(
        settings.database_url,
        echo=settings.database_echo,
        future=True,
    )


engine = create_engine()
session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    """The session dependency.

    One session per request, committed by the route and closed here.
    """
    async with session_factory() as session:
        yield session


async def check_database() -> bool:
    """Whether the database is reachable."""
    from sqlalchemy import text

    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
            if not get_settings().is_local:
                await connection.execute(text("SELECT version_num FROM alembic_version"))
        return True
    except Exception:
        return False


async def create_all() -> None:
    """Creates the tables.

    Alembic owns the migrations in staging and production. This exists for
    the local instance and for the tests, where a file-backed database would
    be slower than an in-memory one for no benefit.
    """
    from . import models  # noqa: F401  (registers the models)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def drop_all() -> None:
    """Drops the tables. For the tests only."""
    from . import models  # noqa: F401

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
