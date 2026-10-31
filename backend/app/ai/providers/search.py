"""The search providers.

Two engines, both behind one interface, both with a free tier that needs no
card:

- **Tavily** — the default. 1,000 credits a month.
- **Exa** — the fallback, when the default has spent its quota. It is the
  engine that powers Groq's own browser search.

The fallback matters because a search quota that runs out mid-cohort is not a
reason to fail a student: the run continues with the other engine, and the
fact that it did is recorded. What is *not* allowed is a search that quietly
returns nothing, because "we found nothing" and "we could not look" are
different answers.
"""

from __future__ import annotations

from typing import Any

import httpx

from ...config import Settings
from ..types import RetrievedSource, SourceQuality
from .base import ProviderError, SearchProvider

TAVILY_URL = "https://api.tavily.com/search"
EXA_URL = "https://api.exa.ai/search"


class TavilySearchProvider:
    """Searches with Tavily."""

    name = "tavily"

    def __init__(self, settings: Settings, *, api_key: str | None = None) -> None:
        self._settings = settings
        self._api_key = api_key
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))

    async def search(
        self,
        query: str,
        *,
        limit: int = 10,
        include_domains: list[str] | None = None,
        search_depth: str = "basic",
    ) -> list[RetrievedSource]:
        key = self._api_key or self._settings.search_provider_key
        if not key:
            raise ProviderError(
                "No search provider is configured.",
                code="PROVIDER_UNAVAILABLE",
                retryable=False,
            )

        body: dict[str, Any] = {
            "api_key": key,
            "query": query,
            "max_results": min(limit, 20),
            "search_depth": search_depth,
            "include_raw_content": False,
        }
        if include_domains:
            body["include_domains"] = include_domains

        try:
            response = await self._client.post(TAVILY_URL, json=body)
        except httpx.HTTPError as error:
            raise ProviderError(
                "The search provider could not be reached.",
                code="PROVIDER_UNAVAILABLE",
                retryable=True,
            ) from error

        if response.status_code == 429:
            raise ProviderError(
                "The search provider's quota is spent.",
                code="RATE_LIMITED",
                retryable=False,
            )
        if response.status_code >= 400:
            raise ProviderError(
                f"The search provider answered with status {response.status_code}.",
                code="PROVIDER_UNAVAILABLE",
                retryable=response.status_code >= 500,
            )

        payload = response.json()
        results = payload.get("results", []) if isinstance(payload, dict) else []

        return [
            RetrievedSource(
                id=_source_id(result.get("url"), index),
                url=str(result.get("url", "")),
                title=str(result.get("title", "")),
                domain=_domain_of(str(result.get("url", ""))),
                excerpt=str(result.get("content", ""))[:2000],
                quality=_quality_of(str(result.get("url", ""))),
                status="retrieved",
            )
            for index, result in enumerate(results)
            if isinstance(result, dict)
        ]

    async def aclose(self) -> None:
        await self._client.aclose()


class ExaSearchProvider:
    """Searches with Exa."""

    name = "exa"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))

    async def search(
        self,
        query: str,
        *,
        limit: int = 10,
        include_domains: list[str] | None = None,
        search_depth: str = "basic",
    ) -> list[RetrievedSource]:
        key = self._settings.fallback_search_provider_key
        if not key:
            raise ProviderError(
                "No fallback search provider is configured.",
                code="PROVIDER_UNAVAILABLE",
                retryable=False,
            )

        try:
            response = await self._client.post(
                EXA_URL,
                headers={"x-api-key": key, "Content-Type": "application/json"},
                json={
                    "query": query,
                    "numResults": min(limit, 10),
                    "type": "auto",
                    "contents": {"text": {"maxCharacters": 2000}},
                },
            )
        except httpx.HTTPError as error:
            raise ProviderError(
                "The fallback search provider could not be reached.",
                code="PROVIDER_UNAVAILABLE",
                retryable=True,
            ) from error

        if response.status_code == 429:
            raise ProviderError(
                "The fallback search provider's quota is spent.",
                code="RATE_LIMITED",
                retryable=False,
            )
        if response.status_code >= 400:
            raise ProviderError(
                f"The fallback search provider answered with status {response.status_code}.",
                code="PROVIDER_UNAVAILABLE",
                retryable=response.status_code >= 500,
            )

        payload = response.json()
        results = payload.get("results", []) if isinstance(payload, dict) else []

        return [
            RetrievedSource(
                id=_source_id(result.get("url"), index),
                url=str(result.get("url", "")),
                title=str(result.get("title", "")),
                domain=_domain_of(str(result.get("url", ""))),
                excerpt=_exa_excerpt(result),
                quality=_quality_of(str(result.get("url", ""))),
                status="retrieved",
            )
            for index, result in enumerate(results)
            if isinstance(result, dict)
        ]

    async def aclose(self) -> None:
        await self._client.aclose()


class FallbackSearchProvider:
    """The default engine, with the second one behind it.

    The fallback is used when the first engine's quota is spent, or when it
    fails in a way that another engine might survive. The engine that
    answered is recorded, so a run says which one found what.
    """

    name = "fallback"

    def __init__(self, primary: SearchProvider, secondary: SearchProvider | None) -> None:
        self._primary = primary
        self._secondary = secondary
        self.engine_used: str | None = None

    async def search(
        self,
        query: str,
        *,
        limit: int = 10,
        include_domains: list[str] | None = None,
        search_depth: str = "basic",
    ) -> list[RetrievedSource]:
        try:
            try:
                results = await self._primary.search(
                    query, limit=limit, include_domains=include_domains, search_depth=search_depth
                )
            except TypeError:
                results = await self._primary.search(query, limit=limit)
            self.engine_used = self._primary.name
            return results
        except ProviderError as error:
            if self._secondary is None or (not error.retryable and error.code != "RATE_LIMITED"):
                raise

        try:
            results = await self._secondary.search(
                query, limit=limit, include_domains=include_domains, search_depth=search_depth
            )
        except TypeError:
            results = await self._secondary.search(query, limit=limit)
        self.engine_used = self._secondary.name
        return results


def _domain_of(url: str) -> str:
    return url.split("://", 1)[-1].split("/", 1)[0]


def _source_id(url: str | None, index: int) -> str:
    """A stable id for a found page."""
    import hashlib

    digest = hashlib.sha256((url or "").encode("utf-8")).hexdigest()[:12]
    return f"src_{digest}" if url else f"src_{index:04d}"


def _quality_of(url: str) -> SourceQuality:
    """A first guess at a source's quality, from its domain.

    It is a guess, and it is treated as one: the evidence carries the
    verdict, not the domain.
    """
    domain = _domain_of(url).lower()
    if domain.endswith((".edu", ".ac.uk")) or ".edu." in domain:
        return "official"
    if any(part in domain for part in ("wikipedia", "blog", "medium", "reddit")):
        return "secondary"
    return "unknown"


def _exa_excerpt(result: dict[str, Any]) -> str:
    """The text Exa returned, if it returned any."""
    text = result.get("text")
    if isinstance(text, str) and text:
        return text[:2000]
    highlights = result.get("highlights")
    if isinstance(highlights, list):
        return " ".join(str(item) for item in highlights)[:2000]
    return ""
