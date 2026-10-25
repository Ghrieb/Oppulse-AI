"""The live providers.

Three properties matter more than the integrations themselves:

- a provider that is not configured never pretends to work;
- a page that could not be reached is recorded as *unavailable*, not as
  nothing found;
- the search falls back to the second engine when the first has spent its
  quota, and says which engine answered.
"""

from __future__ import annotations

import httpx
import pytest

from app.ai.providers import (
    FallbackSearchProvider,
    HttpSourceFetcher,
    ReplayModelProvider,
    ReplaySearchProvider,
    UnavailableEmailProvider,
    build_document_extractor,
    build_fetcher,
    build_model_provider,
    build_search_provider,
)
from app.ai.providers.base import ProviderError
from app.ai.providers.replay import ReplayCorpus
from app.ai.types import ModelRequest
from app.config import Settings


def _settings(**overrides: object) -> Settings:
    return Settings(**overrides)  # type: ignore[arg-type]


def test_the_replay_path_needs_no_keys() -> None:
    settings = _settings(model_provider="replay", search_provider="replay")

    assert isinstance(build_model_provider(settings), ReplayModelProvider)
    assert isinstance(build_search_provider(settings), ReplaySearchProvider)


def test_a_model_provider_without_a_key_refuses_rather_than_guessing() -> None:
    provider = build_model_provider(_settings(model_provider="groq"))

    assert not isinstance(provider, ReplayModelProvider)


def test_a_configured_provider_is_never_silently_replayed() -> None:
    """Asking for Groq and getting fixtures would make a run look reasoned."""
    provider = build_model_provider(_settings(model_provider="groq"))

    assert provider.name == "groq"


async def test_a_model_provider_without_a_key_raises_a_typed_failure() -> None:
    provider = build_model_provider(_settings(model_provider="groq"))

    with pytest.raises(ProviderError) as failure:
        await provider.complete(ModelRequest(stage="mission_interpretation", instruction="hello"))

    assert failure.value.retryable is False
    assert failure.value.code == "PROVIDER_UNAVAILABLE"


async def test_a_page_that_refuses_us_is_unavailable_not_empty() -> None:
    settings = _settings()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, text="no")

    transport = httpx.MockTransport(handler)
    fetcher = HttpSourceFetcher(settings)
    fetcher._client = httpx.AsyncClient(transport=transport)  # type: ignore[assignment]

    source = await fetcher.fetch("https://example.edu/call")

    assert source.status == "unavailable"
    assert source.excerpt
    assert "403" in source.excerpt


async def test_a_page_that_answers_is_read() -> None:
    settings = _settings()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            text="<html><head><title>The Call</title></head><body><p>Hello</p></body></html>",
        )

    transport = httpx.MockTransport(handler)
    fetcher = HttpSourceFetcher(settings)
    fetcher._client = httpx.AsyncClient(transport=transport)  # type: ignore[assignment]

    source = await fetcher.fetch("https://example.edu/call")

    assert source.status == "retrieved"
    assert source.title == "The Call"
    assert "Hello" in source.excerpt
    assert source.content_hash


async def test_the_media_on_a_page_comes_from_its_own_metadata_tags() -> None:
    """The asset is never opened: the tags decide what the page declares."""
    settings = _settings()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            text="""
            <html><head>
              <title>The Call</title>
              <meta property="og:image" content="/media/campus.png">
              <meta property="og:video" content="https://cdn.example.edu/intro.mp4">
              <meta property="og:site_name" content="Example University">
              <meta property="article:published_time" content="2026-01-04">
            </head><body></body></html>
            """,
        )

    transport = httpx.MockTransport(handler)
    fetcher = HttpSourceFetcher(settings)
    fetcher._client = httpx.AsyncClient(transport=transport)  # type: ignore[assignment]

    source = await fetcher.fetch("https://example.edu/call")

    kinds = [item.kind for item in source.media]
    assert kinds == ["image", "video"]
    image = source.media[0]
    assert image.url == "https://example.edu/media/campus.png", "relative tags resolve"
    assert image.publisher == "Example University"
    assert image.published_at == "2026-01-04"
    assert image.status == "not_reviewed", "we read the tag, we did not fetch the asset"
    assert source.media[1].url == "https://cdn.example.edu/intro.mp4"


async def test_a_page_without_media_tags_carries_none() -> None:
    settings = _settings()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/html"},
            text="<html><head><title>No media</title></head><body><p>Plain.</p></body></html>",
        )

    transport = httpx.MockTransport(handler)
    fetcher = HttpSourceFetcher(settings)
    fetcher._client = httpx.AsyncClient(transport=transport)  # type: ignore[assignment]

    source = await fetcher.fetch("https://example.edu/call")

    assert source.media == []


async def test_a_document_that_is_not_html_carries_no_media() -> None:
    settings = _settings()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "application/pdf"},
            content=b"%PDF-1.7 not really",
        )

    transport = httpx.MockTransport(handler)
    fetcher = HttpSourceFetcher(settings)
    fetcher._client = httpx.AsyncClient(transport=transport)  # type: ignore[assignment]

    source = await fetcher.fetch("https://example.edu/call.pdf")

    assert source.media == []


async def test_the_search_falls_back_and_records_which_engine_answered() -> None:
    class Failing:
        name = "first"

        async def search(self, query: str, *, limit: int = 10):
            raise ProviderError("The search provider's quota is spent.", code="RATE_LIMITED")

    class Working:
        name = "second"

        async def search(self, query: str, *, limit: int = 10):
            from app.ai.types import RetrievedSource

            return [
                RetrievedSource(
                    id="src_1",
                    url="https://example.edu/call",
                    title="The Call",
                    domain="example.edu",
                )
            ]

    provider = FallbackSearchProvider(Failing(), Working())  # type: ignore[arg-type]

    results = await provider.search("a query")

    assert len(results) == 1
    assert provider.engine_used == "second"


async def test_the_search_does_not_fall_back_when_the_failure_is_not_recoverable() -> None:
    class Broken:
        name = "first"

        async def search(self, query: str, *, limit: int = 10):
            raise ProviderError("No key.", code="PROVIDER_UNAVAILABLE", retryable=False)

    provider = FallbackSearchProvider(Broken(), None)  # type: ignore[arg-type]

    with pytest.raises(ProviderError):
        await provider.search("a query")


def test_the_email_adapter_refuses_because_there_is_no_provider_yet() -> None:
    provider = UnavailableEmailProvider()

    assert provider.name == "unavailable"


def test_the_document_reader_is_built_even_without_an_ocr_engine() -> None:
    extractor = build_document_extractor(_settings(model_provider="groq"))

    assert extractor is not None
    assert build_fetcher(_settings(model_provider="groq")) is not None


def test_a_replay_corpus_is_enough_to_run_everything_offline() -> None:
    corpus = ReplayCorpus()

    assert corpus.search_results == {}
    assert corpus.pages == {}
