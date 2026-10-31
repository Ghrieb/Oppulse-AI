"""The test configuration.

Every test runs against an in-memory database, and the settings are
overridden before the application is built, so nothing a test does can
reach a file or a real provider.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["OPPULSE_ENVIRONMENT"] = "local"
os.environ["OPPULSE_DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
# The offline path is the tested path: without a key no test may reach a
# provider, so the configured providers answer from the recorded corpus.
os.environ["OPPULSE_MODEL_PROVIDER"] = "replay"
os.environ["OPPULSE_SEARCH_PROVIDER"] = "replay"
os.environ["OPPULSE_MODEL_PROVIDER_KEY"] = ""
os.environ["OPPULSE_SEARCH_PROVIDER_KEY"] = ""
os.environ["OPPULSE_LIVE_MODEL_PROVIDER"] = "false"
os.environ["OPPULSE_LIVE_SEARCH_PROVIDER"] = "false"

from app.config import get_settings
from app.db.session import Base, engine
from app.main import create_app


@pytest.fixture
def settings():
    """The settings, built for a test."""
    return get_settings()


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """An HTTP client bound to the application, over an in-memory database."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    app = create_app(get_settings())
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as http_client:
        yield http_client

    await engine.dispose()
