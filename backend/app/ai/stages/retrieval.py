"""Stage 3 — source retrieval and normalisation.

Not an AI stage. The model has no say in what is reachable: the search
provider finds candidates, the fetcher opens them, and a page that cannot
be opened is recorded as **unavailable** — never as an empty result.

"Everything we found was nothing" and "we could not look" are different
answers, and only one of them is true.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any, ClassVar
from urllib.parse import urlparse, urljoin

from ..providers.base import SearchProvider, SourceFetcher
from ..types import RetrievedSource
from .base import Stage

#: Hosts that never carry verifiable programme information. They are dropped
#: before fetching so a candidate list full of social posts cannot crowd out
#: an official page.
_NOISE_HOSTS = ("facebook.com", "instagram.com", "twitter.com", "x.com",
                "tiktok.com", "reddit.com", "youtube.com")

#: Keywords that indicate a link leads to important official sub-pages.
#: Matched against the lowercase href text (contains check).
_SCHOLARSHIP_KW = ("scholarship", "funding", "finance", "fee", "cost", "stipend", "allowance")
_APPLY_KW = ("apply", "application", "admission", "enrol")
_LANGUAGE_KW = ("language", "english", "proficiency", "ielts", "toefl")
_REQUIREMENT_KW = ("requirement", "eligib", "prerequisite", "criteria")
_STUDY_KW = ("study track", "curriculum", "modules", "programme structure")


def _is_noise(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == noise or host.endswith("." + noise) for noise in _NOISE_HOSTS)


def _domain_priority(url: str) -> int:
    """Lower is better: official-ish TLDs first."""
    host = (urlparse(url).hostname or "").lower()
    if any(host.endswith(tld) for tld in (".edu", ".gov", ".ac.uk")):
        return 0
    if host.endswith(".org") or host.endswith(".eu") or host.endswith(".ac"):
        return 1
    return 2


def _extract_subpage_links(html: str, base_url: str) -> list[dict[str, str]]:
    """Parse a homepage for links to official sub-pages that likely contain
    missing opportunity information (scholarships, costs, language, apply,
    requirements, study tracks).

    Returns a list of {url, reason} dicts, deduplicated and ranked
    by domain priority and keyword relevance.
    """
    parsed_base = urlparse(base_url)
    base_host = (parsed_base.hostname or "").lower()
    base_scheme = parsed_base.scheme

    # Strip scripts/Styles
    clean = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'<style[^>]*>.*?</style>', '', clean, flags=re.DOTALL | re.IGNORECASE)

    links: list[dict[str, str]] = []
    for m in re.finditer(r'<a\s+[^>]*href="([^"]*)"[^>]*>(.*?</a>)?', clean, re.IGNORECASE):
        raw_href = m.group(1)
        inner_text = (m.group(2) or "").lower()
        # Resolve relative URLs
        if raw_href.startswith("http"):
            href = raw_href
        else:
            href = urljoin(f"{base_scheme}://{base_host}", raw_href).rstrip("/")

        # Skip if noise host or same base host
        href_host = urlparse(href).hostname
        if not href_host or href_host in _NOISE_HOSTS or href_host == base_host:
            continue

        # Score by keyword relevance
        score = 0
        kw_list = _SCHOLARSHIP_KW + _APPLY_KW + _LANGUAGE_KW + _REQUIREMENT_KW + _STUDY_KW
        for kw in kw_list:
            if kw in inner_text or kw in href.lower():
                score += 1
        if score == 0:
            continue  # skip irrelevant links

        # Determine reason tag
        if any(kw in inner_text for kw in _SCHOLARSHIP_KW):
            reason = "scholarship"
        elif any(kw in inner_text for kw in _APPLY_KW):
            reason = "apply"
        elif any(kw in inner_text for kw in _LANGUAGE_KW):
            reason = "language"
        elif any(kw in inner_text for kw in _REQUIREMENT_KW):
            reason = "requirement"
        elif any(kw in inner_text for kw in _STUDY_KW):
            reason = "study"
        else:
            reason = "other"

        links.append({"url": href, "reason": reason, "score": score})

    # Deduplicate by URL, keep highest score
    best: dict[str, dict[str, str]] = {}
    for link in links:
        url_key = link["url"].lower()
        if url_key not in best or link["score"] > best[url_key]["score"]:
            best[url_key] = link

    # Sort by domain priority then score (highest first)
    sorted_links = sorted(
        best.values(),
        key=lambda d: (_domain_priority(d["url"]), -d["score"])
    )

    return [
        {"url": d["url"], "reason": d["reason"]}
        for d in sorted_links[:8]  # cap at 8 sub-pages
    ]


class SourceRetrievalStage(Stage):
    """Finds and opens the pages a mission looks at."""

    name: ClassVar[str] = "source_retrieval"

    def __init__(self, search: SearchProvider, fetcher: SourceFetcher) -> None:
        self._search = search
        self._fetcher = fetcher

    async def run(self, payload: dict[str, Any]) -> list[RetrievedSource]:
        query = str(payload.get("query", ""))
        limit = int(payload.get("limit", 10))
        include_domains = payload.get("includeDomains") or []
        candidates = await self._search.search(
            query, limit=limit, include_domains=include_domains if include_domains else None
        )

        # Drop obvious noise (social media, forums) and prefer official-ish
        # domains, so an official page is not crowded out by a Facebook post.
        filtered = [c for c in candidates if not _is_noise(c.url)]
        if not filtered:
            filtered = candidates
        filtered.sort(key=lambda c: _domain_priority(c.url))

        # Opening pages is independent and can be slow. Fetch them together
        # so one unreachable host does not delay the rest; the order of the
        # candidates is kept so the answer stays deterministic.
        pages = await asyncio.gather(
            *(self._fetcher.fetch(candidate.url) for candidate in filtered)
        )

        retrieved: list[RetrievedSource] = []
        for candidate, page in zip(filtered, pages, strict=True):
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

        # ---- NEW: extract sub-page links from the first "homepage"-type source ----
        # If we have at least one fetched page, try to discover additional official
        # sub-pages from its HTML. This is best effort: if the page is unavailable
        # or has no useful links, we simply skip this step.
        if retrieved and retrieved[0].excerpt:
            # Only attempt sub-page discovery on the first source if it looks like
            # a homepage (broad title, no strong programme-specific signals).
            first_title = (retrieved[0].title or "").lower()
            first_excerpt = (retrieved[0].excerpt or "").lower()
            # Heuristic: skip if the title already contains strong programme markers
            strong_markers = ("master", "phd", "fellowship", "scholarship", "internship")
            has_strong_marker = any(m in first_title for m in strong_markers)
            if not has_strong_marker:
                subpage_links = _extract_subpage_links(first_excerpt, retrieved[0].url or "")
                for link in subpage_links:
                    # Fetch the discovered sub-page
                    try:
                        fetched = await self._fetcher.fetch(link["url"])
                        if fetched.status == "retrieved":
                            # Do NOT model_copy again; fetched is already a RetrievedSource
                            retrieved.append(fetched)
                    except Exception:
                        # Silently skip sub-pages that cannot be fetched
                        pass

        return retrieved