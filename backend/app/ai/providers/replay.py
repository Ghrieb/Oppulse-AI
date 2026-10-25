"""The offline implementations.

These are the implementations the evaluation harness runs against. They read
a synthetic corpus and answer from it: no network, no provider key, no real
document. Everything the agent does in the harness is therefore
deterministic and reproducible.

The corpus is data, not code, so a fixture can be read, reviewed and
versioned like any other asset.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..types import (
    DocumentExtractionResult,
    ExtractedPage,
    ModelRequest,
    ModelResponse,
    RetrievedSource,
)
from .base import ProviderError


@dataclass
class ReplayCorpus:
    """The recorded provider answers for one scenario.

    Each list is consumed in order, so a stage that asks twice gets the
    first answer and then the second — which is what makes a multi-turn
    scenario replayable.
    """

    #: stage name -> the answers, in order.
    model_responses: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    #: query -> the candidates a search would have found.
    search_results: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    #: url -> the page a fetch would have returned.
    pages: dict[str, dict[str, Any]] = field(default_factory=dict)
    #: document id -> the extraction a reader would have produced.
    documents: dict[str, dict[str, Any]] = field(default_factory=dict)

    def answer_for(self, stage: str, index: int) -> dict[str, Any]:
        """The recorded answer for a stage.

        The answers are *read*, never consumed: the same corpus must give the
        same answers on every run, or the harness would not be reproducible.
        The last answer repeats, so a stage may be run more than once.
        """
        answers = self.model_responses.get(stage)
        if not answers:
            raise ProviderError(
                f"The replay corpus has no recorded answer for the {stage} stage.",
                code="CONTRACT_MISMATCH",
                retryable=False,
            )
        return answers[min(index, len(answers) - 1)]


class ReplayModelProvider:
    """A model that answers from the corpus."""

    name = "replay"

    def __init__(self, corpus: ReplayCorpus) -> None:
        self._corpus = corpus
        self._index: dict[str, int] = {}
        self.calls: list[ModelRequest] = []

    async def complete(self, request: ModelRequest) -> ModelResponse:
        self.calls.append(request)
        index = self._index.get(request.stage, 0)
        self._index[request.stage] = index + 1
        answer = self._corpus.answer_for(request.stage, index)

        return ModelResponse(
            content=str(answer.get("content", "")),
            parsed=dict(answer.get("parsed", {})),
            model="replay",
            prompt_tokens=int(answer.get("promptTokens", 0)),
            completion_tokens=int(answer.get("completionTokens", 0)),
        )


class ReplaySearchProvider:
    """A search that finds what the corpus says it would find."""

    name = "replay"

    def __init__(self, corpus: ReplayCorpus) -> None:
        self._corpus = corpus

    async def search(self, query: str, *, limit: int = 10) -> list[RetrievedSource]:
        results = self._corpus.search_results.get(query, [])

        return [
            RetrievedSource(
                id=str(result.get("id", f"replay-{index}")),
                url=str(result.get("url", "")),
                title=str(result.get("title", "")),
                domain=str(result.get("domain", "")),
                excerpt=str(result.get("excerpt", "")),
                quality=str(result.get("quality", "unknown")),  # type: ignore[arg-type]
                status=str(result.get("status", "retrieved")),  # type: ignore[arg-type]
                content_hash=result.get("contentHash"),
                retrieved_at=result.get("retrievedAt"),
                page_reference=result.get("pageReference"),
            )
            for index, result in enumerate(results[:limit])
        ]


class ReplaySourceFetcher:
    """A fetcher that opens the pages in the corpus.

    A URL that is not in the corpus comes back as **unavailable** — never
    as an empty result. "We could not reach it" and "there was nothing
    there" are different answers, and the interface shows both.
    """

    name = "replay"

    def __init__(self, corpus: ReplayCorpus) -> None:
        self._corpus = corpus

    async def fetch(self, url: str) -> RetrievedSource:
        page = self._corpus.pages.get(url)

        if page is None:
            return RetrievedSource(
                id=f"unreachable-{abs(hash(url)) % 10_000}",
                url=url,
                title="",
                domain=_domain_of(url),
                excerpt="",
                quality="unknown",
                status="unavailable",
            )

        return RetrievedSource(
            id=str(page.get("id", "")),
            url=url,
            title=str(page.get("title", "")),
            domain=str(page.get("domain", _domain_of(url))),
            excerpt=str(page.get("excerpt", "")),
            quality=str(page.get("quality", "unknown")),  # type: ignore[arg-type]
            status="retrieved",
            content_hash=page.get("contentHash"),
            retrieved_at=page.get("retrievedAt"),
            page_reference=page.get("pageReference"),
            media=page.get("media") or [],
        )


class ReplayDocumentExtractor:
    """A reader that extracts what the corpus says it would extract."""

    name = "replay"

    def __init__(self, corpus: ReplayCorpus) -> None:
        self._corpus = corpus

    def read(self, content: bytes, *, filename: str, mime_type: str) -> DocumentExtractionResult:
        """What the fixture says this document yields."""
        extraction = self._corpus.documents.get(filename)
        if extraction is None:
            return DocumentExtractionResult(
                pages=[],
                unread_sections=["The whole document could not be read."],
                method="none",
            )
        return DocumentExtractionResult(
            pages=[ExtractedPage(number=1, text=str(extraction.get("text", "")))],
            unread_sections=list(extraction.get("unreadSections", [])),
            method=str(extraction.get("method", "text_layer")),  # type: ignore[arg-type]
        )


class UnavailableEmailProvider:
    """The email adapter, before there is one.

    The first student-testing release delivers in-app alerts only, so this
    provider refuses rather than pretending. The seam exists so the backend
    does not have to be redesigned when a mail provider is chosen.
    """

    name = "unavailable"

    async def send(self, *, to: str, subject: str, body: str, idempotency_key: str) -> str:
        raise ProviderError(
            "No email provider is connected. Alerts stay in the app.",
            code="PROVIDER_UNAVAILABLE",
            retryable=False,
        )


def _domain_of(url: str) -> str:
    """The host of a URL, without a parser."""
    without_scheme = url.split("://", 1)[-1]
    return without_scheme.split("/", 1)[0]
