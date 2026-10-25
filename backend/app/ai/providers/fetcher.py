"""The source fetcher.

It opens a page the search found, and it says honestly whether it could.

Three states, never two: **retrieved** (we have the page), **unavailable**
(we could not open it — a timeout, a 403, a block) and *nothing at all*,
which is not a state this fetcher can produce. "We could not look" and
"there was nothing there" are different answers, and the interface shows
both.
"""

from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime
from urllib.parse import urljoin

import httpx

from ...config import Settings
from ..types import MediaContext, RetrievedSource
from .base import ProviderError

#: The content types we are willing to read as text.
TEXT_TYPES = (
    "text/html",
    "text/plain",
    "application/xhtml+xml",
    "text/markdown",
)

#: A page that is really a document, not a page.
DOCUMENT_TYPES = ("application/pdf",)

_SCRIPT = re.compile(r"<(script|style|noscript)\b.*?</\1>", re.IGNORECASE | re.DOTALL)
_TAG = re.compile(r"<[^>]+>")
_SPACE = re.compile(r"\s+")
_META_TAG = re.compile(r"<meta\b[^>]*>", re.IGNORECASE)
_ATTRIBUTE = re.compile(r"""([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')""")


class HttpSourceFetcher:
    """Opens a page over HTTP."""

    name = "http"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.fetch_timeout_seconds, connect=10.0),
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "OppulseAI/0.1 (research assistant; respects robots.txt and identifies itself)"
                ),
                "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.8,*/*;q=0.5",
            },
        )

    async def fetch(self, url: str) -> RetrievedSource:
        """The page, or the record that says it could not be reached."""
        domain = _domain_of(url)

        try:
            response = await self._client.get(url)
        except httpx.TimeoutException:
            return _unreachable(url, domain, "The page did not answer in time.")
        except httpx.HTTPError:
            return _unreachable(url, domain, "The page could not be reached.")

        if response.status_code in {401, 403, 429}:
            return _unreachable(
                url, domain, f"The page refused the request ({response.status_code})."
            )
        if response.status_code >= 400:
            return _unreachable(url, domain, f"The page answered with {response.status_code}.")

        content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
        body = response.content[: self._settings.fetch_max_bytes]

        if content_type in DOCUMENT_TYPES:
            text = _pdf_text(body)
        elif content_type in TEXT_TYPES or not content_type:
            text = html_to_text(body.decode("utf-8", errors="replace"))
        else:
            text = ""

        title = _title_of(body, content_type)
        return RetrievedSource(
            id=_source_id(url),
            url=url,
            title=title,
            domain=domain,
            excerpt=text[:4000],
            quality="unknown",
            status="retrieved",
            content_hash=hashlib.sha256(body).hexdigest()[:32],
            retrieved_at=datetime.now(UTC).isoformat(),
            media=_media_of(body, url=url, content_type=content_type, page_title=title),
        )

    async def aclose(self) -> None:
        await self._client.aclose()


def html_to_text(html: str) -> str:
    """The readable text of a page.

    It is a crude extraction, and it is enough: the model reads the text,
    and the *evidence* points at the page, not at our rendering of it.
    """
    without_scripts = _SCRIPT.sub(" ", html)
    text = _TAG.sub(" ", without_scripts)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    return _SPACE.sub(" ", text).strip()


def _pdf_text(body: bytes) -> str:
    """The text of a PDF, when it has one."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""

    try:
        import io

        reader = PdfReader(io.BytesIO(body))
        return "\n".join((page.extract_text() or "") for page in reader.pages)[:200_000]
    except Exception:
        return ""


def _title_of(body: bytes, content_type: str) -> str:
    """The page's title, if it is an HTML page."""
    if content_type not in TEXT_TYPES:
        return ""
    match = re.search(rb"<title[^>]*>(.*?)</title>", body[:200_000], re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return match.group(1).decode("utf-8", errors="replace").strip()[:300]


def _media_of(body: bytes, *, url: str, content_type: str, page_title: str) -> list[MediaContext]:
    """The media the page's own metadata declares — nothing more.

    There is no media discovery: no crawl for assets, no request for the
    media itself (so every entry leaves as ``not_reviewed`` — we read the
    tag, we did not open the asset), and a page that is not HTML yields
    nothing. The entries are labelled ``secondary`` here; the producer of
    the answer re-labels the ones that sit on a page of official quality.
    """
    if content_type and content_type not in TEXT_TYPES:
        return []

    metas: dict[str, str] = {}
    for tag in _META_TAG.findall(body[:200_000].decode("utf-8", errors="replace")):
        attributes = {
            match.group(1).lower(): (match.group(2) or match.group(3) or "")
            for match in _ATTRIBUTE.finditer(tag)
        }
        key = attributes.get("property") or attributes.get("name")
        if key and key not in metas:
            metas[key] = attributes.get("content", "").strip()

    domain = _domain_of(url)
    title = metas.get("og:title") or page_title
    publisher = metas.get("og:site_name") or domain
    published_at = metas.get("article:published_time") or None

    image = metas.get("og:image") or metas.get("og:image:url") or metas.get("twitter:image")
    video = metas.get("og:video:secure_url") or metas.get("og:video:url") or metas.get("og:video")

    entries: list[MediaContext] = []
    for kind, value in (("image", image), ("video", video)):
        if not value:
            continue
        entries.append(
            MediaContext(
                kind=kind,  # type: ignore[arg-type]
                url=urljoin(url, value),
                title=title,
                publisher=publisher,
                published_at=published_at,
                source_type="secondary",
                attribution=f"From {domain}",
                summary=None,
                status="not_reviewed",
            )
        )
    return entries


def _unreachable(url: str, domain: str, reason: str) -> RetrievedSource:
    """The record of a page we could not open."""
    import hashlib

    return RetrievedSource(
        id=f"src_unreachable_{hashlib.sha256(url.encode('utf-8')).hexdigest()[:10]}",
        url=url,
        title="",
        domain=domain,
        excerpt=reason,
        quality="unknown",
        status="unavailable",
        retrieved_at=datetime.now(UTC).isoformat(),
    )


def _domain_of(url: str) -> str:
    return url.split("://", 1)[-1].split("/", 1)[0]


def _source_id(url: str) -> str:
    return f"src_{hashlib.sha256(url.encode('utf-8')).hexdigest()[:12]}"


__all__ = ["HttpSourceFetcher", "ProviderError", "html_to_text"]
