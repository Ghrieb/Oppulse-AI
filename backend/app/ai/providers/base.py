"""The provider interfaces.

Five seams, so the agent never talks to a vendor directly:

- ``ModelProvider`` — structured reasoning and drafting;
- ``SearchProvider`` — discovery;
- ``SourceFetcher`` — controlled retrieval of a known page;
- ``DocumentExtractor`` — PDF and DOCX reading;
- ``EmailNotificationProvider`` — a future adapter, not wired up.

Every one of them has a **replay** implementation that answers from
synthetic fixtures, with no network, no provider key and no real document.
That is what makes the whole agent loop runnable — and testable — offline.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..types import (
    DocumentExtractionResult,
    ModelRequest,
    ModelResponse,
    RetrievedSource,
)


class ProviderError(Exception):
    """A provider failed.

    It is always typed, because a failure has to become a recoverable state
    and never an empty result.
    """

    def __init__(self, message: str, *, code: str = "PROVIDER_UNAVAILABLE", retryable: bool = True):
        super().__init__(message)
        self.code = code
        self.retryable = retryable


@runtime_checkable
class ModelProvider(Protocol):
    """Structured reasoning and drafting."""

    name: str

    async def complete(self, request: ModelRequest) -> ModelResponse:
        """Answers one request, validated against the request's schema."""
        ...

    async def chat(
        self,
        *,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> ModelResponse:
        """Answers a short conversational question without a structured schema."""
        ...


@runtime_checkable
class SearchProvider(Protocol):
    """Discovery: finding candidate pages."""

    name: str

    async def search(self, query: str, *, limit: int = 10) -> list[RetrievedSource]:
        """Returns the candidates it found, with their reachability."""
        ...


@runtime_checkable
class SourceFetcher(Protocol):
    """Retrieval: opening a page the agent already knows about."""

    name: str

    async def fetch(self, url: str) -> RetrievedSource:
        """Returns the page, or a record that says it could not be reached."""
        ...


@runtime_checkable
class DocumentExtractor(Protocol):
    """Reading a document the student uploaded."""

    name: str

    def read(self, content: bytes, *, filename: str, mime_type: str) -> DocumentExtractionResult:
        """Returns the pages we could read, and the ones we could not."""
        ...


@runtime_checkable
class EmailNotificationProvider(Protocol):
    """Sending a message.

    A future adapter. The first student-testing release delivers in-app
    alerts only, so nothing calls this yet — but the seam exists, so the
    backend does not have to be redesigned when it does.
    """

    name: str

    async def send(self, *, to: str, subject: str, body: str, idempotency_key: str) -> str:
        """Sends one message and returns its delivery id."""
        ...
