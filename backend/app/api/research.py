"""The research results.

The opportunities the agent found, and the one action the student should
take next.

The research data is stored as the agent produced it, so this module does
not re-shape it — it decides *whose* it is and what may be done with it.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.rules.next_action import derive_next_action
from ..db.models import (
    Alert,
    Application,
    Draft,
    Match,
    Opportunity,
    Profile,
    Source,
)
from ..db.session import get_session
from ..errors import not_found, validation
from ..security.session import CurrentUser, current_user
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
            "saved": opportunity.saved,
            "dismissed": opportunity.dismissed,
            "createdAt": iso_utc(opportunity.created_at),
        },
        "match": _match_out(match) if match is not None else None,
    }


@router.get("/opportunities", response_model=OpportunityListOut)
async def list_opportunities(
    request: Request,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> OpportunityListOut:
    """The opportunities, ranked against the confirmed profile."""
    query = select(Opportunity)
    parameters = request.query_params

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

    matches = list((await session.execute(select(Match))).scalars().all())
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


@router.get("/opportunities/{id}", response_model=OpportunityDetailOut)
async def read_opportunity(
    id: str,
    user: CurrentUser = Depends(current_user),
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

    application_result = await session.execute(
        select(Application).where(Application.owner_id == user.id, Application.opportunity_id == id)
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

    from ..db.models import Mission, Run, RunEvent

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

    run = Run(
        mission_id=mission.id,
        owner_id=user.id,
        status="queued",
        phase="queued",
        budget={},
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

    return {"runId": run.id, "status": "queued"}


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
