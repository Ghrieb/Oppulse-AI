"""Stage 3 — source retrieval and normalisation.

Not an AI stage. The model has no say in what is reachable: the search
provider finds candidates, the fetcher opens them, and a page that cannot
be opened is recorded as **unavailable** — never as an empty result.

"Everything we found was nothing" and "we could not look" are different
answers, and only one of them is true.
"""

from __future__ import annotations

from typing import Any, ClassVar

from ..providers.base import SearchProvider, SourceFetcher
from ..types import RetrievedSource
from .base import Stage


class SourceRetrievalStage(Stage):
    """Finds and opens the pages a mission looks at."""

    name: ClassVar[str] = "source_retrieval"

    def __init__(self, search: SearchProvider, fetcher: SourceFetcher) -> None:
        self._search = search
        self._fetcher = fetcher

    async def run(self, payload: dict[str, Any]) -> list[RetrievedSource]:
        query = str(payload.get("query", ""))
        limit = int(payload.get("limit", 10))
        candidates = await self._search.search(query, limit=limit)

        retrieved: list[RetrievedSource] = []
        for candidate in candidates:
            page = await self._fetcher.fetch(candidate.url)
            # The page's own metadata wins: the fetcher saw the real
            # document, not only the search result's summary of it.
            retrieved.append(
                page.model_copy(
                    update={
                        "id": page.id or candidate.id,
                        "title": page.title or candidate.title,
                        "excerpt": page.excerpt or candidate.excerpt,
                        "quality": page.quality if page.quality != "unknown" else candidate.quality,
                    }
                )
            )

        return retrieved
