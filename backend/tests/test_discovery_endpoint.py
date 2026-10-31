"""The minimal live discovery path persists source-backed opportunities."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.requests import Request

from app.ai.types import RetrievedSource
from app.api.research import DiscoverRequest, discover_opportunities, list_opportunities
from app.config import Settings
from app.db.models import Base, Opportunity, Source, User
from app.db.session import engine


@pytest.fixture
async def session() -> AsyncSession:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as current:
        yield current
    await engine.dispose()


@pytest.mark.asyncio
async def test_discovery_saves_deduplicated_source_backed_cards(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """One search becomes a card which survives a fresh list request."""

    user = User(email="student@example.com", full_name="Student", password_hash="hash")
    session.add(user)
    await session.commit()

    class Search:
        async def search(self, _query: str, *, limit: int = 10) -> list[RetrievedSource]:
            assert limit == 3
            return [
                RetrievedSource(
                    id="search-result",
                    url="https://university.example.edu/masters/genetics",
                    title="MSc Genetics",
                    domain="university.example.edu",
                )
            ]

        async def aclose(self) -> None:
            return None

    class Fetcher:
        async def fetch(self, url: str) -> RetrievedSource:
            return RetrievedSource(
                id="page",
                url=url,
                title="MSc Genetics",
                domain="university.example.edu",
                excerpt="MSc Genetics application. Full scholarship. Apply by 1 June.",
                content_hash="content-hash",
            )

        async def aclose(self) -> None:
            return None

    class Model:
        async def complete(self, _request: object) -> SimpleNamespace:
            return SimpleNamespace(
                parsed={
                    "is_opportunity": True,
                    "is_official_source": True,
                    "title": "MSc Genetics",
                    "institution": "Example University",
                    "country_name": None,
                    "country_iso2": None,
                    "opportunity_type": "scholarship",
                    "deadline": "2026-06-01",
                    "funding_coverage": "fully_funded",
                    "funding_information": "Full scholarship.",
                    "eligibility": ["Bachelor's degree in genetics or a related field"],
                    "requirements": ["Submit academic transcripts"],
                    "summary": "A source-backed genetics Master's application.",
                }
            )

        async def aclose(self) -> None:
            return None

    import app.ai.providers as providers
    import app.config as config

    live = Settings(
        model_provider="groq",
        search_provider="tavily",
        model_provider_key="groq-test-key",
        search_provider_key="tavily-test-key",
        live_model_provider=True,
        live_search_provider=True,
    )
    monkeypatch.setattr(config, "get_settings", lambda: live)
    monkeypatch.setattr(providers, "build_search_provider", lambda _settings: Search())
    monkeypatch.setattr(providers, "build_fetcher", lambda _settings: Fetcher())
    monkeypatch.setattr(providers, "build_model_provider", lambda _settings: Model())

    request = DiscoverRequest(objective="Find fully funded Master's programmes in genetics")
    first = await discover_opportunities(request, user, session)
    second = await discover_opportunities(request, user, session)

    assert len(first.opportunities) == 1
    assert len(second.opportunities) == 1
    first_card = first.opportunities[0].model_extra or {}
    assert first_card["canonicalUrl"] == "https://university.example.edu/masters/genetics"
    assert first_card["country"]["name"] == "Not specified"
    assert len((await session.execute(select(Opportunity))).scalars().all()) == 1
    assert len((await session.execute(select(Source))).scalars().all()) == 1

    refreshed = await list_opportunities(
        Request({"type": "http", "query_string": b""}), user, session
    )
    assert [item.id for item in refreshed.opportunities] == [first.opportunities[0].id]
