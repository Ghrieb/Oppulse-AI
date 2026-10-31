"""The research results.

The opportunities the agent found, and the one action the student should
take next.

The research data is stored as the agent produced it, so this module does
not re-shape it — it decides *whose* it is and what may be done with it.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy import false, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.rules.next_action import derive_next_action
from ..db.models import (
    Alert,
    Application,
    Draft,
    Evidence,
    Match,
    Mission,
    Opportunity,
    Profile,
    Run,
    Source,
    Thread,
    ThreadTurn,
)
from ..db.session import get_session
from ..errors import not_found, provider_failure, provider_unavailable, validation
from ..security.session import CurrentUser, current_user, optional_user
from ..wire import WireModel, iso_utc
from .shapes import (
    AnalyzeRequest,
    CompareOut,
    CompareRowOut,
    NextActionOut,
    NextActionResponseOut,
    OpportunityDetailOut,
    OpportunityListOut,
    ResearchRecord,
)

router = APIRouter(tags=["research"])


class DismissRequest(WireModel):
    reason: str | None = Field(default=None, max_length=500)


class DiscoverRequest(WireModel):
    objective: str = Field(..., min_length=10)
    filters: dict[str, Any] = Field(default_factory=dict)
    max_results: int = Field(default=8, ge=1, le=8)


def _evidence_out(evidence: Any) -> dict[str, Any]:
    """A claim, and the passage it came from."""
    return {
        "id": evidence.id,
        "sourceId": evidence.source_id,
        "opportunityId": evidence.opportunity_id,
        "claim": evidence.claim,
        "excerpt": evidence.excerpt,
        "pageReference": evidence.page_reference,
        "url": evidence.url,
        "retrievedAt": iso_utc(evidence.retrieved_at),
        "quality": evidence.quality,
        "stance": evidence.stance,
        "confidence": evidence.confidence,
    }


def _source_out(source: Any) -> dict[str, Any]:
    """A retrieved source."""
    return {
        "id": source.id,
        "runId": source.run_id,
        "url": source.url,
        "title": source.title,
        "domain": source.domain,
        "excerpt": source.excerpt,
        "quality": source.quality,
        "status": source.status,
        "contentHash": source.content_hash,
        "retrievedAt": iso_utc(source.retrieved_at),
        "pageReference": source.page_reference,
        "failureReason": source.failure_reason,
    }


def _match_out(match: Any) -> dict[str, Any]:
    """An assessment, in the shape the contract lists.

    The fit score is a *match*, never a likelihood of admission, and the
    label says so.
    """
    return {
        "id": match.id,
        "missionId": match.mission_id,
        "opportunityId": match.opportunity_id,
        "fitScore": match.fit_score,
        "fitLabel": match.fit_label,
        "eligibility": match.eligibility,
        "competitiveness": match.competitiveness,
        "confidence": match.confidence,
        "reasons": list(match.reasons or []),
        "warnings": list(match.warnings or []),
        "recommendation": match.recommendation,
        "profileSnapshotId": match.profile_snapshot_id,
        "createdAt": iso_utc(match.created_at),
    }


def _row(opportunity: Opportunity, match: Any) -> dict[str, Any]:
    """An opportunity, with the caller's assessment beside it."""
    return {
        "opportunity": {
            "id": opportunity.id,
            "title": opportunity.title,
            "institution": opportunity.institution,
            "type": opportunity.type,
            "country": opportunity.country,
            "sourceDomain": opportunity.source_domain,
            "canonicalUrl": opportunity.canonical_url,
            "summary": opportunity.summary,
            "institutionBrand": opportunity.institution_brand,
            "duration": opportunity.duration,
            "applicationOpensAt": opportunity.application_opens_at,
            "tags": opportunity.tags,
            "deadline": opportunity.deadline,
            "additionalDeadlines": opportunity.additional_deadlines,
            "funding": opportunity.funding,
            "requirements": opportunity.requirements,
            "highlights": getattr(opportunity, "highlights", []) or [],
            "fieldStatus": getattr(opportunity, "field_status", {}) or {},
            "saved": opportunity.saved,
            "dismissed": opportunity.dismissed,
            "createdAt": iso_utc(opportunity.created_at),
        },
        "match": _match_out(match) if match is not None else None,
    }


_OPPORTUNITY_TYPES = {
    "research_internship",
    "fellowship",
    "scholarship",
    "summer_school",
    "research_program",
    "grant",
    "course",
    "conference",
    "other",
}


def _opportunity_type(value: str) -> str:
    normalized = value.strip().lower().replace(" ", "_")
    return normalized if normalized in _OPPORTUNITY_TYPES else "other"


def _brand(institution: str | None, domain: str) -> dict[str, Any]:
    return {
        "institutionName": institution or "Not specified",
        "officialDomain": domain,
        "logoUrl": None,
        "bannerUrl": None,
        "attribution": None,
        "verifiedAt": None,
        "source": "official",
        "generated": True,
        "iconSource": "none",
    }


def _deadline(value: str | None) -> dict[str, Any]:
    return {
        "value": value,
        "timezone": None,
        "status": "verified" if value else "not_found",
        "remainingDays": None,
        "evidenceId": None,
        "conflicts": [],
        "note": None if value else "Not specified",
    }


def _funding(coverage: str, note: str | None) -> dict[str, Any]:
    return {
        "coverage": coverage,
        "components": [],
        "estimatedGap": None,
        "note": note or "Not specified",
    }


def _institution_fallback(domain: str) -> str:
    """A readable source label when a page does not name its institution."""
    label = domain.removeprefix("www.").split(".")[0].replace("-", " ").strip()
    return label.title() if label else "Institution not stated"


def _summary_fallback(excerpt: str, title: str) -> str:
    cleaned = " ".join(excerpt.split())
    if cleaned:
        return cleaned[:360].rstrip(" ,;:") + ("…" if len(cleaned) > 360 else "")
    return f"See the source page for details about {title}."


def _quality_of_url(url: str) -> str:
    """Classify domain quality based on defensible official source rules."""
    from urllib.parse import urlparse
    domain = urlparse(url or "").netloc.lower()
    if domain.endswith((".edu", ".ac.uk", ".gov", ".edu.cn", ".edu.au", ".edu.ca", ".edu.sg")) or ".edu." in domain:
        return "official"
    if any(part in domain for part in ("wikipedia", "blog", "medium", "reddit", "facebook", "twitter", "linkedin")):
        return "secondary"
    return "primary"


def _extract_source_excerpt(source_text: str, label: str) -> str:
    """Extract a genuine passage from source text that relates to the label."""
    if not source_text:
        return "Passage not directly quoted from source."
    # Try to find sentences containing the label
    label_lower = label.lower()
    sentences = source_text.replace('\n', ' ').split('.')
    for sentence in sentences:
        sentence_stripped = sentence.strip()
        if not sentence_stripped:
            continue
        if label_lower in sentence_stripped.lower():
            # Return the sentence as excerpt (add period back if it was there)
            excerpt = sentence_stripped
            if len(excerpt) > 300:
                excerpt = excerpt[:297] + "..."
            elif not excerpt.endswith(('.', '!', '?')):
                # Check if original had period
                pass
            return excerpt
    # If no sentence contains the label, take a real chunk from source
    excerpt = source_text.strip()[:300]
    if len(source_text.strip()) > 300:
        excerpt = excerpt.rstrip() + "..."
    return excerpt if excerpt else "Passage not directly quoted from source."


def _requirements(
    session: AsyncSession, labels: list[str], source: Source, opportunity: Opportunity
) -> list[dict[str, Any]]:
    """Persist an evidence record for each source-backed requirement without fabricating excerpts."""
    requirements: list[dict[str, Any]] = []
    source_text = source.excerpt or source.page_reference or ""
    # Determine source quality from domain, not just from model
    source_quality = _quality_of_url(source.url)
    # Override if source already has quality and it's more specific
    if source.quality in ("official", "primary", "secondary") and source_quality != "secondary":
        # Prefer domain-based classification for authority
        domain_quality = _quality_of_url(source.url)
        source_quality = domain_quality

    for label in dict.fromkeys(label.strip() for label in labels if label.strip()):
        # Use genuine source excerpt, never use the label as the excerpt
        excerpt = _extract_source_excerpt(source_text, label)
        is_exact = label.lower() in source_text.lower()
        
        evidence = Evidence(
            id=str(uuid.uuid4()),
            source_id=source.id,
            opportunity_id=opportunity.id,
            claim=label,
            excerpt=excerpt,
            page_reference=source.page_reference,
            url=source.url,
            quality=source_quality,
            stance="supports",
            confidence="high" if (is_exact and source_quality == "official") else ("medium" if is_exact else "low"),
        )
        session.add(evidence)
        requirements.append(
            {
                "id": str(uuid.uuid4()),
                "label": label,
                "kind": "other",
                "status": "unresolved",
                "sourceClause": excerpt if excerpt and excerpt != "Passage not directly quoted from source." else label,
                "evidenceIds": [evidence.id],
                "profileFactKey": None,
                "check": None,
                "ageRule": None,
                "blocking": True,
                "explanation": "Not specified",
            }
        )
    return requirements


async def _trigger_assistant_discovery(
    session: AsyncSession, run_id: str, objective: str, owner_id: str
) -> None:
    """Trigger assistant discovery via a message."""

    # Find or create the thread for this run
    result = await session.execute(select(Thread).where(Thread.id == run_id))
    thread = result.scalar_one_or_none()

    if thread is None:
        # Create thread if it doesn't exist
        thread = Thread(
            id=run_id,
            owner_id=owner_id,
            mission_id=None,
        )
        session.add(thread)
        await session.flush()

    # Record a turn that triggers discovery
    turn = ThreadTurn(
        thread_id=thread.id,
        owner_id=thread.owner_id,
        mission_id=thread.mission_id,
        role="user",
        content=objective,
        blocks=[],
        context={"objective": objective, "discovery_triggered": True},
        selected_fact_ids=[],
        selected_document_ids=[],
        consent_state={"allowProfileMatching": True, "externalModelProcessing": False},
        run_id=run_id,
    )
    session.add(turn)
    await session.commit()


@router.get("/opportunities", response_model=OpportunityListOut)
async def list_opportunities(
    request: Request,
    user: CurrentUser | None = Depends(optional_user),
    session: AsyncSession = Depends(get_session),
) -> OpportunityListOut:
    """The opportunities, ranked against the confirmed profile."""
    query = select(Opportunity)
    parameters = request.query_params

    query = (
        query.where(Opportunity.owner_id == user.id) if user is not None else query.where(false())
    )

    if parameters.get("type"):
        query = query.where(Opportunity.type == parameters["type"])
    if parameters.get("saved") == "true":
        query = query.where(Opportunity.saved.is_(True))
    if parameters.get("dismissed") == "true":
        query = query.where(Opportunity.dismissed.is_(True))
    else:
        query = query.where(Opportunity.dismissed.is_(False))

    opportunities = list((await session.execute(query)).scalars().all())

    # The funding filter reads a JSON column, which is cheaper and more
    # portable in Python than in SQL.
    if parameters.get("funding"):
        wanted = parameters["funding"]
        opportunities = [
            opportunity
            for opportunity in opportunities
            if (opportunity.funding or {}).get("coverage") == wanted
        ]

    matches = (
        list((await session.execute(select(Match))).scalars().all()) if user is not None else []
    )
    by_opportunity = {match.opportunity_id: match for match in matches}

    return OpportunityListOut(
        opportunities=[
            _row(opportunity, by_opportunity.get(opportunity.id))["opportunity"]
            for opportunity in opportunities
        ],
        matches=[
            _row(opportunity, by_opportunity.get(opportunity.id))["match"]
            for opportunity in opportunities
            if opportunity.id in by_opportunity
        ],
        next_cursor=None,
        has_more=False,
    )


@router.post("/opportunities/discover")
async def discover_opportunities(
    body: DiscoverRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> OpportunityListOut:
    """Run one bounded live discovery and persist only supported results."""
    from urllib.parse import urlparse

    from ..ai.providers import build_fetcher, build_model_provider, build_search_provider
    from ..ai.providers.base import ProviderError
    from ..ai.types import ModelRequest, OpportunityExtraction
    from ..config import get_settings

    settings = get_settings()
    if not settings.search_is_live or not settings.model_is_live:
        raise provider_unavailable(
            "Live opportunity discovery is unavailable until Tavily and Groq are configured."
        )

    filters = body.filters or {}
    mission = Mission(
        owner_id=user.id,
        title="Opportunity Discovery",
        objective=body.objective,
        criteria={
            "objective": body.objective,
            "filters": filters,
            "max_results": body.max_results,
            "opportunityTypes": filters.get("opportunity_types") or filters.get("opportunityTypes") or [],
            "fundingPreference": filters.get("funding_preference") or filters.get("fundingPreference") or "any",
            "destinations": filters.get("destinations") or [],
            "destinationCountries": filters.get("destination_countries") or filters.get("destinationCountries") or [],
        },
        status="active",
        source="assistant",
    )
    session.add(mission)
    await session.flush()

    # Create run for the discovery mission
    run_id = str(uuid.uuid4())
    run = Run(
        id=run_id,
        mission_id=mission.id,
        owner_id=user.id,
        status="running",
        phase="searching",
        budget={
            "max_tokens": 8000,
            "max_cost": 10.0,
            "time_limit": 300,
        },
        checkpoint={
            "stage": "discovery",
        },
        attempt=0,
        idempotency_key=None,
    )
    session.add(run)
    await session.flush()

    search = build_search_provider(settings)
    fetcher = build_fetcher(settings)
    model = build_model_provider(settings)
    saved: list[Opportunity] = []
    try:
        # Build query incorporating filters like the worker does
        query_parts = [body.objective]
        funding_pref = filters.get("funding_preference") or filters.get("fundingPreference") or "any"
        if funding_pref == "fully_funded":
            query_parts.append("fully funded")
        elif funding_pref == "partial_ok":
            query_parts.append("partially funded")
        opp_types = filters.get("opportunity_types") or filters.get("opportunityTypes") or []
        for t in opp_types[:2]:
            if isinstance(t, str):
                query_parts.append(t.replace("_", " "))
        countries = filters.get("destination_countries") or filters.get("destinationCountries") or []
        # Map common country codes to names if needed
        country_names = {
            "US": "United States", "GB": "United Kingdom", "CA": "Canada", "DE": "Germany",
            "FR": "France", "NL": "Netherlands", "SE": "Sweden", "NO": "Norway", "DK": "Denmark",
            "FI": "Finland", "CH": "Switzerland", "AU": "Australia"
        }
        for c in countries[:3]:
            if isinstance(c, str):
                c_up = c.upper()
                query_parts.append(country_names.get(c_up, c))
        query_parts.append("official programme application funding eligibility")
        query = " ".join(str(p) for p in query_parts if p)
        try:
            results = await search.search(query, limit=3, search_depth="advanced")
        except TypeError:
            results = await search.search(query, limit=3)
        seen_urls: set[str] = set()
        for result in results:
            if len(saved) >= body.max_results or result.url in seen_urls:
                continue
            seen_urls.add(result.url)
            # Tavily already supplies a usable result excerpt. Avoid serially
            # fetching every page in a serverless request; only fetch when
            # the search result is too thin for a source-backed extraction.
            page = result
            if len(page.excerpt.strip()) < 400:
                fetched = await fetcher.fetch(result.url)
                if fetched.status == "retrieved" and fetched.excerpt.strip():
                    page = fetched
            if page.status != "retrieved" or not page.excerpt.strip():
                continue

            response = await model.complete(
                ModelRequest(
                    stage="opportunity_extraction",
                    response_schema="OpportunityExtraction",
                    instruction=(
                        "Read this search result or retrieved page and extract one genuine academic "
                        "opportunity. Return is_opportunity=true only when the result supports an "
                        "actual programme, scholarship, fellowship, internship or application call. "
                        "Set is_official_source=true only for an official institution or programme "
                        "source. Extract title, institution, country, funding, deadline, eligibility "
                        "and a concise source-grounded summary whenever stated. Return null for details "
                        "the source does not state; never invent dates, funding or requirements."
                    ),
                    context={
                        "url": page.url,
                        "title": page.title,
                        "page_text": page.excerpt[:6000],
                    },
                )
            )
            extracted = OpportunityExtraction.model_validate(response.parsed)
            title = extracted.title or page.title or result.title
            if not (extracted.is_opportunity and title):
                continue

            duplicate = await session.scalar(
                select(Opportunity).where(
                    Opportunity.owner_id == user.id, Opportunity.canonical_url == page.url
                )
            )
            if duplicate is not None:
                saved.append(duplicate)
                continue

            domain = urlparse(page.url).netloc
            source_quality = _quality_of_url(page.url)
            source = Source(
                run_id=run.id,
                url=page.url,
                title=page.title or title,
                domain=domain,
                excerpt=page.excerpt[:4000],
                quality=source_quality,
                status="retrieved",
                content_hash=page.content_hash or "",
                page_reference=page.page_reference,
            )
            session.add(source)
            await session.flush()
            opportunity = Opportunity(
                owner_id=user.id,
                title=title,
                institution=extracted.institution or _institution_fallback(domain),
                type=_opportunity_type(extracted.opportunity_type),
                country={
                    "iso2": (extracted.country_iso2 or "XX").upper(),
                    "name": extracted.country_name or "Not specified",
                    "kind": "country" if extracted.country_name else "region",
                    "region": None,
                },
                source_domain=domain,
                canonical_url=page.url,
                summary=extracted.summary or _summary_fallback(page.excerpt, title),
                institution_brand=_brand(extracted.institution, domain),
                duration=None,
                application_opens_at=None,
                tags=list(
                    dict.fromkeys(
                        [
                            _opportunity_type(extracted.opportunity_type),
                            *( ["Master's"] if "master" in body.objective.lower() else [] ),
                            *( ["Physics"] if "physics" in body.objective.lower() else [] ),
                        ]
                    )
                ),
                deadline=_deadline(extracted.deadline),
                additional_deadlines=[],
                funding=_funding(extracted.funding_coverage, extracted.funding_information),
                requirements=[],
                highlights=[
                    item
                    for item in [
                        extracted.funding_information,
                        extracted.deadline and f"Deadline: {extracted.deadline}",
                    ]
                    if item
                ],
                field_status={},
                saved=False,
                dismissed=False,
            )
            session.add(opportunity)
            await session.flush()
            opportunity.requirements = _requirements(
                session, [*extracted.eligibility, *extracted.requirements], source, opportunity
            )
            saved.append(opportunity)

        run.status = "completed"
        run.phase = "done"
        run.finished_at = datetime.now(UTC)
        run.summary = {
            "sourcesReviewed": len(seen_urls),
            "candidatesFound": len(saved),
            "needingVerification": 0,
            "unreachable": 0,
        }
        run.checkpoint = {"stage": "done"}
        await session.commit()
    except ProviderError as error:
        await session.rollback()
        raise provider_failure(
            error.code, "Opportunity discovery could not complete. Please try again."
        ) from error
    finally:
        for provider in (search, fetcher, model):
            close = getattr(provider, "aclose", None)
            if close is not None:
                await close()

    return OpportunityListOut(
        opportunities=[_row(opportunity, None)["opportunity"] for opportunity in saved],
        matches=[],
        next_cursor=None,
        has_more=False,
    )


@router.get("/opportunities/{id}", response_model=OpportunityDetailOut)
async def read_opportunity(
    id: str,
    user: CurrentUser | None = Depends(optional_user),
    session: AsyncSession = Depends(get_session),
) -> OpportunityDetailOut:
    """One opportunity, with its evidence and its sources."""
    from ..db.models import Evidence

    result = await session.execute(select(Opportunity).where(Opportunity.id == id))
    opportunity = result.scalar_one_or_none()
    if opportunity is None:
        raise not_found("That opportunity")

    match_result = await session.execute(select(Match).where(Match.opportunity_id == id))
    match = match_result.scalar_one_or_none()

    evidence = list(
        (await session.execute(select(Evidence).where(Evidence.opportunity_id == id)))
        .scalars()
        .all()
    )
    sources = list((await session.execute(select(Source))).scalars().all())

    application = None
    if user is not None:
        application_result = await session.execute(
            select(Application).where(
                Application.owner_id == user.id, Application.opportunity_id == id
            )
        )
        application = application_result.scalar_one_or_none()

    return OpportunityDetailOut(
        opportunity=_row(opportunity, match)["opportunity"],
        match=ResearchRecord.model_validate(_match_out(match)) if match is not None else None,
        evidence=[ResearchRecord.model_validate(_evidence_out(item)) for item in evidence],
        sources=[ResearchRecord.model_validate(_source_out(item)) for item in sources],
        application_id=application.id if application is not None else None,
    )


@router.post("/opportunities/{id}/save", response_model=OpportunityDetailOut)
async def save_opportunity(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> OpportunityDetailOut:
    """Saves an opportunity to the student's plan."""
    result = await session.execute(select(Opportunity).where(Opportunity.id == id))
    opportunity = result.scalar_one_or_none()
    if opportunity is None:
        raise not_found("That opportunity")

    opportunity.saved = True
    await session.commit()

    return await read_opportunity(id=id, user=user, session=session)


@router.post("/opportunities/{id}/dismiss", response_model=OpportunityDetailOut)
async def dismiss_opportunity(
    id: str,
    body: DismissRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> OpportunityDetailOut:
    """Hides an opportunity from the student's list."""
    result = await session.execute(select(Opportunity).where(Opportunity.id == id))
    opportunity = result.scalar_one_or_none()
    if opportunity is None:
        raise not_found("That opportunity")

    opportunity.dismissed = True
    await session.commit()

    return await read_opportunity(id=id, user=user, session=session)


@router.post("/opportunities/analyze")
async def analyze_opportunity(
    body: AnalyzeRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Analyses a link without saving a mission first.

    It starts a research run, and the run is durable: the browser may close
    and the run continues.
    """
    if not body.url.strip():
        raise validation(
            "Paste the link to the opportunity you want analysed.",
            {"url": ["A link is required."]},
        )

    from ..db.models import Mission, Opportunity, Run, RunEvent

    mission_result = await session.execute(select(Mission).where(Mission.owner_id == user.id))
    mission = mission_result.scalars().first()

    if mission is None:
        mission = Mission(
            owner_id=user.id,
            title="Ad-hoc analysis",
            objective=f"Analyse {body.url}",
            criteria={},
            status="active",
            source="assistant",
            monitoring={"enabled": False, "frequency": "weekly"},
        )
        session.add(mission)
        await session.flush()

    # Create an opportunity row up front so the detail page has something to
    # show while the run works. Fields are filled in as the run progresses.
    from urllib.parse import urlparse

    parsed = urlparse(body.url)
    host = parsed.hostname or "unknown"
    opportunity = Opportunity(
        title=f"Analysis of {host}",
        institution=host,
        type="other",
        country={},
        source_domain=host,
        canonical_url=body.url,
        summary="",
        institution_brand={},
        duration=None,
        application_opens_at=None,
        tags=["analyzed"],
        deadline={
            "value": None,
            "timezone": None,
            "status": "pending",
            "remainingDays": None,
            "evidenceId": None,
            "conflicts": [],
            "note": None,
        },
        additional_deadlines=[],
        funding={"coverage": "unknown", "components": [], "estimatedGap": None, "note": None},
        requirements=[],
        highlights=[],
        field_status={
            "deadline": "pending",
            "requirements": "pending",
            "funding": "pending",
            "highlights": "pending",
        },
        saved=False,
        dismissed=False,
    )
    session.add(opportunity)
    await session.flush()

    run = Run(
        mission_id=mission.id,
        owner_id=user.id,
        status="queued",
        phase="queued",
        budget={},
        checkpoint={"opportunityId": opportunity.id, "stage": "queued"},
    )
    session.add(run)
    await session.flush()

    session.add(
        RunEvent(
            run_id=run.id,
            type="run.queued",
            message="The run is queued.",
            data={"missionId": mission.id},
            created_at=datetime.now(UTC),
        )
    )
    mission.latest_run_id = run.id
    await session.commit()

    return {"runId": run.id, "status": "queued", "opportunityId": opportunity.id}


@router.post("/opportunities/{id}/applications", status_code=201)
async def create_application(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Turns a saved opportunity into a workspace.

    The checklist is drawn from the call, and it is the same checklist the
    assistant offers — so the student sees one list, not two.
    """
    from ..api.workspace import _application_out

    result = await session.execute(select(Opportunity).where(Opportunity.id == id))
    opportunity = result.scalar_one_or_none()
    if opportunity is None:
        raise not_found("That opportunity")

    existing = (
        await session.execute(
            select(Application).where(
                Application.owner_id == user.id, Application.opportunity_id == opportunity.id
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return _application_out(existing).model_dump(by_alias=True)

    application = Application(
        owner_id=user.id,
        opportunity_id=opportunity.id,
        opportunity_title=opportunity.title,
        institution=opportunity.institution,
        status="considering",
        deadline=(opportunity.deadline or {}).get("value"),
        deadline_verified=(opportunity.deadline or {}).get("status") == "verified",
        checklist=[
            {
                "id": f"5f{index:07d}-0000-4000-8000-000000000001",
                "label": requirement.get("label"),
                "status": "ready" if requirement.get("status") == "likely" else "needs_attention",
                "source": requirement.get("sourceClause"),
                "dueDate": None,
                "documentId": None,
                "note": requirement.get("explanation"),
            }
            for index, requirement in enumerate(opportunity.requirements, start=1)
        ],
        tasks=[],
        draft_ids=[],
        completion={
            "completed": sum(
                1
                for requirement in opportunity.requirements
                if requirement.get("status") == "likely"
            ),
            "total": len(opportunity.requirements),
        },
        next_best_action="Confirm the requirements you still cannot meet.",
        official_url=opportunity.canonical_url,
    )
    session.add(application)
    await session.commit()

    return _application_out(application).model_dump(by_alias=True)


@router.post("/opportunities/compare", response_model=CompareOut)
async def compare_opportunities(
    body: dict[str, Any],
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> CompareOut:
    """Compares two to four opportunities side by side.

    It is a read of what the agent already found: the same eligibility,
    funding and deadline, with the differences named. It never invents a
    ranking the evidence does not support.
    """
    ids = body.get("opportunityIds") or []
    if not isinstance(ids, list) or len(ids) < 2:
        raise validation(
            "Pick at least two opportunities to compare.",
            {"opportunityIds": ["Two or more are needed."]},
        )

    result = await session.execute(select(Opportunity).where(Opportunity.id.in_(ids)))
    opportunities = list(result.scalars().all())

    if len(opportunities) != len(ids):
        raise not_found("One of those opportunities")

    from ..db.models import Match

    matches = list((await session.execute(select(Match))).scalars().all())
    by_opportunity = {match.opportunity_id: match for match in matches}

    rows: list[CompareRowOut] = []
    for opportunity in opportunities:
        match = by_opportunity.get(opportunity.id)
        funding = opportunity.funding or {}
        gap = funding.get("estimatedGap") or {}
        unresolved = [
            str(requirement.get("label", ""))
            for requirement in opportunity.requirements
            if requirement.get("status") == "unresolved"
        ]

        rows.append(
            CompareRowOut(
                opportunity_id=opportunity.id,
                title=opportunity.title,
                institution=opportunity.institution,
                country=str((opportunity.country or {}).get("name", "")),
                fit_score=int(getattr(match, "fit_score", 0) or 0),
                eligibility=str(getattr(match, "eligibility", "unresolved")),
                deadline=(opportunity.deadline or {}).get("value"),
                deadline_verified=(opportunity.deadline or {}).get("status") == "verified",
                funding_coverage=str(funding.get("coverage", "unknown")),
                estimated_gap=gap.get("amount"),
                currency=gap.get("currency"),
                unresolved_requirements=unresolved,
            )
        )

    differences: list[str] = []
    unverified: list[str] = []

    deadlines = [row for row in rows if row.deadline_verified and row.deadline]
    if len(deadlines) > 1:
        earliest = min(deadlines, key=lambda row: row.deadline or "")
        differences.append(f"{earliest.title} closes first, on {earliest.deadline}.")

    gaps = [row for row in rows if (row.estimated_gap or 0) > 0]
    if gaps:
        differences.append(
            f"{len(gaps)} of them leave a cost you would have to cover: "
            f"{', '.join(row.title for row in gaps)}."
        )

    blocked = [row for row in rows if row.unresolved_requirements]
    if blocked:
        differences.append(
            f"{len(blocked)} of them still have requirements you have not confirmed yet."
        )

    best = max(rows, key=lambda row: row.fit_score, default=None)
    if best is not None:
        differences.append(
            f"{best.title} matches your profile best, at {best.fit_score} out of 100."
        )

    if any(row.deadline and not row.deadline_verified for row in rows):
        unverified.append("At least one deadline has not been confirmed by an official source.")
    if any(row.eligibility == "unresolved" for row in rows):
        unverified.append(
            "Some eligibility questions are still open, so the comparison is partial."
        )

    return CompareOut(rows=rows, differences=differences, unverified=unverified)


@router.get("/next-action", response_model=NextActionResponseOut)
async def read_next_action(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> NextActionResponseOut:
    """The one action the student should take next.

    It is derived, not authored: the same inputs always produce the same
    recommendation, and it is always tied to a real blocker.
    """

    profile_result = await session.execute(select(Profile).where(Profile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()

    opportunities = list((await session.execute(select(Opportunity))).scalars().all())
    applications = list(
        (await session.execute(select(Application).where(Application.owner_id == user.id)))
        .scalars()
        .all()
    )
    drafts = list(
        (await session.execute(select(Draft).where(Draft.owner_id == user.id))).scalars().all()
    )
    sources = list((await session.execute(select(Source))).scalars().all())
    alerts = list(
        (
            await session.execute(
                select(Alert).where(Alert.owner_id == user.id).order_by(Alert.created_at)
            )
        )
        .scalars()
        .all()
    )

    facts = []
    if profile is not None:
        from ..db.models import ProfileFact

        fact_rows = list(
            (await session.execute(select(ProfileFact).where(ProfileFact.profile_id == profile.id)))
            .scalars()
            .all()
        )
        facts = [
            {
                "id": fact.id,
                "key": fact.key,
                "label": fact.label,
                "value": fact.value,
                "numericValue": fact.numeric_value,
                "code": fact.code,
                "status": fact.status,
                "excluded": fact.excluded,
                "source": None,
            }
            for fact in fact_rows
        ]

    action = derive_next_action(
        profile={"facts": facts} if facts else None,
        opportunities=[opportunity.__dict__ for opportunity in opportunities],
        applications=[application.__dict__ for application in applications],
        drafts=[draft.__dict__ for draft in drafts],
        sources=[source.__dict__ for source in sources],
        alerts=[alert.__dict__ for alert in alerts],
        documents=[
            {"id": document.id, "filename": document.filename, "status": document.status}
            for document in (
                (
                    await session.execute(
                        select(__import__("app.db.models", fromlist=["Document"]).Document).where(
                            __import__("app.db.models", fromlist=["Document"]).Document.owner_id
                            == user.id
                        )
                    )
                )
                .scalars()
                .all()
            )
        ],
        now=datetime.now(UTC).isoformat(),
    )

    if action is None:
        return NextActionResponseOut(action=None)

    return NextActionResponseOut(
        action=NextActionOut.model_validate(
            {
                "id": action["id"],
                "kind": action["kind"],
                "title": action["title"],
                "rationale": action["rationale"],
                "cta": action["cta"],
                "route": action["route"],
                "priority": action["priority"],
                "blocker_id": action.get("blockerId"),
                "created_at": action["createdAt"],
            }
        )
    )
