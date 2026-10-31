"""The providers.

A factory that builds the configured set, so the rest of the service never
asks which provider it is talking to.
"""

from __future__ import annotations

from ...config import Settings
from .base import (
    DocumentExtractor,
    EmailNotificationProvider,
    ModelProvider,
    ProviderError,
    SearchProvider,
    SourceFetcher,
)
from .document import DocumentReader, LocalOcrEngine, UnavailableOcrEngine
from .email import HttpEmailProvider
from .fetcher import HttpSourceFetcher
from .groq import GroqModelProvider
from .replay import (
    ReplayCorpus,
    ReplayDocumentExtractor,
    ReplayModelProvider,
    ReplaySearchProvider,
    ReplaySourceFetcher,
    UnavailableEmailProvider,
)
from .search import ExaSearchProvider, FallbackSearchProvider, TavilySearchProvider

__all__ = [
    "DocumentExtractor",
    "DocumentReader",
    "EmailNotificationProvider",
    "ExaSearchProvider",
    "FallbackSearchProvider",
    "GroqModelProvider",
    "HttpEmailProvider",
    "HttpSourceFetcher",
    "LocalOcrEngine",
    "ModelProvider",
    "ProviderError",
    "ReplayCorpus",
    "ReplayDocumentExtractor",
    "ReplayModelProvider",
    "ReplaySearchProvider",
    "ReplaySourceFetcher",
    "SearchProvider",
    "SourceFetcher",
    "TavilySearchProvider",
    "UnavailableEmailProvider",
    "UnavailableOcrEngine",
    "build_document_extractor",
    "build_email_provider",
    "build_fetcher",
    "build_model_provider",
    "build_runtime_model_provider",
    "build_runtime_search_provider",
    "build_search_provider",
]


def build_model_provider(settings: Settings, corpus: ReplayCorpus | None = None) -> ModelProvider:
    """The model provider the configuration asks for.

    A provider that is *configured* but has no key is a misconfiguration, and
    it fails loudly: silently replaying fixtures where the operator asked for
    a live model would make the run look like it reasoned when it did not.
    The offline path is the explicit ``replay`` mode.
    """
    if settings.model_provider == "replay":
        return ReplayModelProvider(corpus or ReplayCorpus())
    return GroqModelProvider(settings)


def build_runtime_model_provider(
    settings: Settings, corpus: ReplayCorpus | None = None
) -> ModelProvider:
    """Build the provider permitted by the effective capability flag."""
    if not settings.live_model_provider:
        return ReplayModelProvider(corpus or ReplayCorpus())
    return build_model_provider(settings, corpus)


def build_search_provider(settings: Settings, corpus: ReplayCorpus | None = None) -> SearchProvider:
    """The search provider, with the second engine behind the first."""
    if settings.search_provider == "replay":
        primary: SearchProvider = ReplaySearchProvider(corpus or ReplayCorpus())
    elif settings.search_provider == "exa":
        primary = ExaSearchProvider(settings)
    else:
        primary = TavilySearchProvider(settings)

    secondary: SearchProvider | None = None
    if settings.fallback_search_provider_key:
        if settings.fallback_search_provider == "tavily":
            secondary = TavilySearchProvider(
                settings, api_key=settings.fallback_search_provider_key
            )
        else:
            secondary = ExaSearchProvider(settings)

    if secondary is None:
        return primary
    return FallbackSearchProvider(primary, secondary)


def build_runtime_search_provider(
    settings: Settings, corpus: ReplayCorpus | None = None
) -> SearchProvider:
    """Build the search provider permitted by the effective capability flag."""
    if not settings.live_search_provider:
        return ReplaySearchProvider(corpus or ReplayCorpus())
    return build_search_provider(settings, corpus)


def build_fetcher(settings: Settings, corpus: ReplayCorpus | None = None) -> SourceFetcher:
    """The source fetcher."""
    if settings.model_provider == "replay":
        return ReplaySourceFetcher(corpus or ReplayCorpus())
    return HttpSourceFetcher(settings)


def build_document_extractor(
    settings: Settings, corpus: ReplayCorpus | None = None
) -> DocumentExtractor:
    """The document reader.

    It reads the file on our own machine. Only the text of the pages it
    could read is ever sent to a model provider.
    """
    if settings.model_provider == "replay":
        return ReplayDocumentExtractor(corpus or ReplayCorpus())

    engine = LocalOcrEngine() if LocalOcrEngine().available() else UnavailableOcrEngine()
    return DocumentReader(ocr=engine)


def build_email_provider(settings: Settings) -> EmailNotificationProvider:
    """Build the configured email provider."""
    if settings.email_provider_url and settings.email_provider_key:
        return HttpEmailProvider(settings)
    return UnavailableEmailProvider()
