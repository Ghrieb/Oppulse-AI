"""The run worker.

A run is a row with a lease: one worker claims it, walks the stages of the
research pipeline, and writes a factual event for everything that happens.
The browser never holds the run — it reads the row and the timeline, so a
refresh, a pause or a process restart neither loses the run nor starts a
second one.

The walk is **checkpointed**: after every stage the outputs are stored on
the run together with the stage that comes next. A retry, a resume after a
crash, and a lease that ran out all re-enter at the stored stage, so the
stages that already finished are not redone and their events are not
duplicated.

Everything here is deterministic outside the two AI stages, and the AI
stages run behind the same provider seam as the rest of the service: replay
recorded answers until a key exists, the real provider after the smoke test.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import Settings, get_settings
from ..db.models import (
    Match,
    Mission,
    Opportunity,
    Profile,
    ProfileFact,
    ProtectedProfile,
    Run,
    RunEvent,
)
from ..logging import get_logger

logger = get_logger("runs.worker")

#: The stages, in the order the walk executes them. The checkpoint's
#: ``stage`` is the *next* stage, so ``done`` means the walk is finished.
STAGES = ("planning", "searching", "extracting", "matching", "explaining", "done")

#: Statuses a run cannot leave on its own.
TERMINAL_STATUSES = frozenset({"completed", "partial", "failed", "cancelled"})

#: Which coarse phase each stage reports while it runs.
STAGE_PHASE = {
    "planning": "understanding",
    "searching": "searching",
    "extracting": "extracting",
    "matching": "evaluating",
    "explaining": "saving",
    "done": "done",
}

#: How the funding preference reads in a search query.
FUNDING_QUERY_TEXT = {
    "fully_funded": "fully funded",
    "partial_ok": "partially funded",
    "any": "",
}

#: ISO-3166 codes to names, for the queries. A code the table does not
#: have is sent as itself rather than dropped: the student's criterion is
#: never silently ignored.
COUNTRY_NAMES = {
    "AT": "Austria",
    "BE": "Belgium",
    "BG": "Bulgaria",
    "CA": "Canada",
    "CH": "Switzerland",
    "CZ": "Czechia",
    "DE": "Germany",
    "DK": "Denmark",
    "EE": "Estonia",
    "ES": "Spain",
    "FI": "Finland",
    "FR": "France",
    "GB": "United Kingdom",
    "GR": "Greece",
    "HR": "Croatia",
    "HU": "Hungary",
    "IE": "Ireland",
    "IT": "Italy",
    "LT": "Lithuania",
    "LU": "Luxembourg",
    "LV": "Latvia",
    "NL": "Netherlands",
    "NO": "Norway",
    "PL": "Poland",
    "PT": "Portugal",
    "RO": "Romania",
    "SE": "Sweden",
    "SI": "Slovenia",
    "SK": "Slovakia",
    "US": "United States",
}


# --------------------------------------------------------------------- #
# The query plan                                                         #
# --------------------------------------------------------------------- #


def build_search_queries(objective: str, criteria: dict[str, Any]) -> list[str]:
    """The queries one run sends, in the student's priority order.

    Deterministic on purpose: the criteria are the student's own, so the
    same mission always searches the same way, and changing a country
    changes the query — §11.5's rule that the selected countries affect
    the search. One query per country, or one scoped query when the
    student chose regions rather than countries.
    """
    funding = FUNDING_QUERY_TEXT.get(str(criteria.get("fundingPreference", "") or ""), "")
    types = " ".join(
        str(kind).replace("_", " ") for kind in list(criteria.get("opportunityTypes", []))[:2]
    )
    interests = " ".join(
        str(interest) for interest in list(criteria.get("academicInterests", []))[:2]
    )
    destinations = " ".join(str(value) for value in criteria.get("destinations", []))
    countries = [str(code).upper() for code in criteria.get("destinationCountries", [])]

    base = " ".join(part for part in (objective.strip(), funding, types, interests) if part)
    if not base:
        base = objective.strip() or "opportunities"

    if countries:
        return [
            " ".join(part for part in (base, destinations, COUNTRY_NAMES.get(code, code)) if part)
            for code in countries
        ]
    return [" ".join(part for part in (base, destinations) if part)]


def in_scope(opportunity: dict[str, Any], criteria: dict[str, Any]) -> bool:
    """Whether one opportunity is a candidate for these criteria.

    The student's country list is the strongest criterion; when they
    chose regions instead, the region decides. Types and a strict
    fully-funded preference narrow it further. With no criteria at all
    everything is a candidate — nothing is filtered out silently.
    """
    countries = {str(code).upper() for code in criteria.get("destinationCountries", [])}
    destinations = {str(value).casefold() for value in criteria.get("destinations", [])}
    types = {str(value) for value in criteria.get("opportunityTypes", [])}
    funding_preference = str(criteria.get("fundingPreference", "") or "")

    country = opportunity.get("country") or {}

    if countries:
        iso2 = str(country.get("iso2", "")).upper()
        if iso2 and iso2 not in countries:
            return False
    elif destinations:
        region = str(country.get("region", "")).casefold()
        name = str(country.get("name", "")).casefold()
        if region and region not in destinations and name not in destinations:
            return False

    if types and str(opportunity.get("type", "")) not in types:
        return False

    if funding_preference == "fully_funded":
        coverage = str((opportunity.get("funding") or {}).get("coverage", ""))
        if coverage != "fully_funded":
            return False

    return True


@functools.cache
def run_corpus() -> Any:
    """The recorded answers a replay run answers from.

    The ten fixtures and the three scenarios, merged into one corpus: the
    recorded model answers are concatenated per stage (the last one
    repeats), and the recorded searches and pages are pooled. This is
    what makes a run runnable with no network and no key.
    """
    from ..evaluation.fixtures.cases import FIXTURES, SCENARIOS
    from .providers.replay import ReplayCorpus

    merged = ReplayCorpus()
    for fixture in (*FIXTURES, *SCENARIOS):
        for stage, answers in fixture.corpus.model_responses.items():
            merged.model_responses.setdefault(stage, []).extend(answers)
        merged.search_results.update(fixture.corpus.search_results)
        merged.pages.update(fixture.corpus.pages)
        merged.documents.update(fixture.corpus.documents)
    return merged


# --------------------------------------------------------------------- #
# Claiming                                                               #
# --------------------------------------------------------------------- #


async def claim_run(session: AsyncSession, *, worker_id: str, lease_seconds: int) -> Run | None:
    """The next run this worker may work on, or nothing.

    Two runs are claimable: one that is queued, and one whose worker died
    and whose lease ran out. The claim is a conditional update — if any
    other worker took it first, the update matches nothing and this
    worker walks away.
    """
    now = datetime.now(UTC)
    lease_deadline = now - timedelta(seconds=lease_seconds)
    claimable = or_(
        Run.status == "queued",
        and_(
            Run.status == "running",
            Run.lease_expires_at.is_not(None),
            Run.lease_expires_at < lease_deadline,
        ),
    )

    candidate = (
        await session.execute(select(Run.id).where(claimable).order_by(Run.created_at).limit(1))
    ).scalar_one_or_none()
    if candidate is None:
        return None

    await session.execute(
        update(Run)
        .where(Run.id == candidate, claimable)
        .values(
            status="running",
            claimed_by=worker_id,
            lease_expires_at=now + timedelta(seconds=lease_seconds),
            attempt=Run.attempt + 1,
            # A run has one start: the first claim, not every reclaim after
            # a pause or a crash.
            started_at=func.coalesce(Run.started_at, now),
        )
    )
    await session.commit()

    # Whoever holds the lease now owns the run. If another worker won the
    # race, this update matched nothing and `claimed_by` says so. The row
    # is re-read from the database: the update was a Core statement, so a
    # session that already had this run in its identity map would answer
    # with the pre-claim values.
    claimed = await session.get(Run, candidate)
    if claimed is None:
        return None
    await session.refresh(claimed)
    if claimed.claimed_by != worker_id:
        return None
    return claimed


# --------------------------------------------------------------------- #
# The walk                                                               #
# --------------------------------------------------------------------- #


def _emit_once(
    session: AsyncSession,
    run: Run,
    checkpoint: dict[str, Any],
    event_type: str,
    message: str,
    data: dict[str, Any] | None = None,
) -> None:
    """Adds one event to the timeline, at most once per run.

    The emitted types are recorded in the checkpoint, so a stage that is
    entered again after a crash or a pause does not claim twice to have
    started.
    """
    emitted = set(checkpoint.get("emitted", []))
    if event_type in emitted:
        return

    session.add(
        RunEvent(
            run_id=run.id,
            type=event_type,
            message=message,
            data=data,
            created_at=datetime.now(UTC),
        )
    )
    emitted.add(event_type)
    checkpoint["emitted"] = sorted(emitted)


async def _at_checkpoint(
    session: AsyncSession, run: Run, *, worker_id: str, settings: Settings
) -> bool:
    """Re-reads the run between stages: pause, cancel, lease.

    Returns ``False`` when this worker must stop touching the run: the
    student paused or cancelled it, or another worker holds the lease now.
    """
    await session.refresh(run)

    if run.claimed_by != worker_id:
        logger.warning("lease_lost", {"run_id": run.id, "worker_id": worker_id})
        return False

    if run.status in {"paused", "cancelled"}:
        await session.execute(
            update(Run)
            .where(Run.id == run.id, Run.claimed_by == worker_id)
            .values(claimed_by=None, lease_expires_at=None)
        )
        await session.commit()
        return False

    run.lease_expires_at = datetime.now(UTC) + timedelta(seconds=settings.run_lease_seconds)
    return True


async def _release(session: AsyncSession, run: Run, worker_id: str) -> None:
    """Hands the lease back."""
    await session.execute(
        update(Run)
        .where(Run.id == run.id, Run.claimed_by == worker_id)
        .values(claimed_by=None, lease_expires_at=None)
    )


async def _profile_row(session: AsyncSession, owner_id: str) -> Profile | None:
    result = await session.execute(select(Profile).where(Profile.user_id == owner_id))
    return result.scalar_one_or_none()


async def _confirmed_facts(session: AsyncSession, owner_id: str) -> list[dict[str, Any]]:
    """The facts a stage may lean on: confirmed and not excluded."""
    profile = await _profile_row(session, owner_id)
    if profile is None:
        return []
    rows = list(
        (await session.execute(select(ProfileFact).where(ProfileFact.profile_id == profile.id)))
        .scalars()
        .all()
    )
    return [
        {
            "id": fact.id,
            "key": fact.key,
            "label": fact.label,
            "value": fact.value,
            "status": fact.status,
        }
        for fact in rows
        if fact.status == "confirmed" and not fact.excluded
    ]


async def _unconfirmed_facts(session: AsyncSession, owner_id: str) -> list[ProfileFact]:
    profile = await _profile_row(session, owner_id)
    if profile is None:
        return []
    rows = list(
        (await session.execute(select(ProfileFact).where(ProfileFact.profile_id == profile.id)))
        .scalars()
        .all()
    )
    return [fact for fact in rows if fact.status != "confirmed" and not fact.excluded]


def _fact_contract(fact: ProfileFact) -> dict[str, Any]:
    """A fact as the rule engine reads it: contract shape, nothing extra."""
    contract: dict[str, Any] = {
        "id": fact.id,
        "key": fact.key,
        "label": fact.label,
        "value": fact.value,
        "status": fact.status,
        "excluded": fact.excluded,
    }
    if fact.numeric_value is not None:
        contract["numericValue"] = fact.numeric_value
    if fact.code is not None:
        contract["code"] = fact.code
    if fact.source_document_name is not None:
        contract["source"] = {"documentName": fact.source_document_name}
    return contract


def _opportunity_contract(opportunity: Opportunity) -> dict[str, Any]:
    """An opportunity row in the shape the rule engine takes."""
    return {
        "id": opportunity.id,
        "title": opportunity.title,
        "institution": opportunity.institution,
        "type": opportunity.type,
        "country": opportunity.country,
        "sourceDomain": opportunity.source_domain,
        "canonicalUrl": opportunity.canonical_url,
        "summary": opportunity.summary,
        "deadline": opportunity.deadline,
        "additionalDeadlines": opportunity.additional_deadlines,
        "funding": opportunity.funding,
        "requirements": list(opportunity.requirements or []),
        "saved": opportunity.saved,
        "dismissed": opportunity.dismissed,
    }


def _match_contract(match: Match) -> dict[str, Any]:
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
    }


def _protected_contract(protected: ProtectedProfile | None) -> dict[str, Any] | None:
    if protected is None:
        return None
    return {
        "dateOfBirth": {
            "value": protected.date_of_birth,
            "status": protected.date_of_birth_status,
            "excludedFromAiContext": protected.excluded_from_ai_context,
        }
    }


async def _assessment_inputs(
    session: AsyncSession, owner_id: str, criteria: dict[str, Any]
) -> tuple[
    list[dict[str, Any]], list[dict[str, Any]], dict[str, Any] | None, dict[str, Any] | None
]:
    """The candidate opportunities and the profile to assess them against.

    The country criterion decides which opportunities are candidates —
    §11.5's rule that the selected countries affect the ranking, here
    applied before the rule engine runs.
    """
    opportunity_rows = list((await session.execute(select(Opportunity))).scalars().all())
    candidates = [
        _opportunity_contract(row)
        for row in opportunity_rows
        if in_scope(_opportunity_contract(row), criteria)
    ]
    candidate_ids = {candidate["id"] for candidate in candidates}

    match_rows = list((await session.execute(select(Match))).scalars().all())
    matches = [_match_contract(row) for row in match_rows if row.opportunity_id in candidate_ids]

    profile_row = await _profile_row(session, owner_id)
    profile: dict[str, Any] | None = None
    if profile_row is not None:
        fact_rows = list(
            (
                await session.execute(
                    select(ProfileFact).where(ProfileFact.profile_id == profile_row.id)
                )
            )
            .scalars()
            .all()
        )
        profile = {"facts": [_fact_contract(fact) for fact in fact_rows]}

    protected_row = (
        await session.execute(select(ProtectedProfile).where(ProtectedProfile.owner_id == owner_id))
    ).scalar_one_or_none()

    return candidates, matches, profile, _protected_contract(protected_row)


async def _fail_run(
    session: AsyncSession,
    run: Run,
    checkpoint: dict[str, Any],
    *,
    code: str,
    message: str,
    retryable: bool,
    worker_id: str,
) -> None:
    """Records a stage failure honestly.

    A run that reached sources stops at ``partial`` — the sources it did
    reach are kept and the failed stage can be retried. A run that
    reached nothing is ``failed``. Either way the lease goes back.
    """
    now = datetime.now(UTC)
    reached = sum(
        1 for source in checkpoint.get("sources", []) if source.get("status") == "retrieved"
    )
    status = "partial" if reached else "failed"
    event_type = "run.partial" if status == "partial" else "run.failed"
    detail = f"The run could not finish: {message}"
    if status == "partial":
        detail = f"{detail} The {reached} sources it reached are kept."

    run.status = status
    run.finished_at = now
    run.error = {"code": code, "message": message, "retryable": retryable}
    await _release(session, run, worker_id)
    _emit_once(session, run, checkpoint, event_type, detail, {"stage": checkpoint.get("stage")})
    # The checkpoint at the moment of failure is part of the outcome: the
    # retry re-enters at this stage, and the timeline must not claim twice
    # for what this pass already wrote.
    if checkpoint:
        run.checkpoint = dict(checkpoint)
    await session.commit()


async def process_run(
    session: AsyncSession, run: Run, *, settings: Settings, worker_id: str
) -> None:
    """Walks one claimed run to its end, or to a failure it can retry from.

    Every stage ends in a commit: the events, the checkpoint and the
    budget are durable before the next stage starts, so the timeline a
    student sees is exactly what has actually happened.
    """
    from .context import as_untrusted
    from .providers import build_fetcher, build_model_provider, build_search_provider
    from .stages.explanation import EvidenceGroundedExplanationStage
    from .stages.matching import ConfirmedProfileMatchingStage
    from .stages.mission import MissionInterpretationStage
    from .stages.requirements import RequirementExtractionStage
    from .stages.retrieval import SourceRetrievalStage

    mission = await session.get(Mission, run.mission_id)
    if mission is None:
        await _fail_run(
            session,
            run,
            {},
            code="NOT_FOUND",
            message="The mission this run belongs to no longer exists.",
            retryable=False,
            worker_id=worker_id,
        )
        return

    criteria = dict(mission.criteria or {})
    checkpoint: dict[str, Any] = dict(run.checkpoint or {})
    budget: dict[str, Any] = dict(run.budget or {})
    stage = str(checkpoint.get("stage", "planning"))
    if stage not in STAGES:
        stage = "planning"

    corpus = run_corpus()
    model = build_model_provider(settings, corpus)
    search = build_search_provider(settings, corpus)
    fetcher = build_fetcher(settings, corpus)

    pass_started = time.monotonic()

    try:
        while stage != "done":
            if not await _at_checkpoint(session, run, worker_id=worker_id, settings=settings):
                return
            pass_started = _finish_pass(budget, pass_started)

            if stage == "planning":
                run.phase = "understanding"
                _emit_once(session, run, checkpoint, "run.started", "The run started.")
                _emit_once(
                    session,
                    run,
                    checkpoint,
                    "understanding.started",
                    "Interpreting the mission into a search plan.",
                )
                # The events and the mark that they were written are one
                # commit: a crash between here and the stage's end must not
                # make the timeline claim twice to have started.
                run.checkpoint = dict(checkpoint)
                await session.commit()

                plan = await MissionInterpretationStage(model).run(
                    {
                        "goal": mission.objective,
                        "allowedScope": {
                            "destinations": criteria.get("destinations", []),
                            "destinationCountries": criteria.get("destinationCountries", []),
                        },
                        "confirmedFacts": await _confirmed_facts(session, run.owner_id),
                    }
                )
                budget["modelCalls"] = int(budget.get("modelCalls", 0)) + 1
                queries = build_search_queries(plan.objective or mission.objective, criteria)
                scope = len(criteria.get("destinations", [])) + len(
                    criteria.get("destinationCountries", [])
                )

                checkpoint["plan"] = plan.model_dump()
                checkpoint["queries"] = queries
                checkpoint["stage"] = "searching"
                _emit_once(
                    session,
                    run,
                    checkpoint,
                    "understanding.completed",
                    f"Plan built: {len(queries)} queries covering {scope} scope areas.",
                    {"queries": len(queries), "sourceScope": scope},
                )
                run.phase = "searching"
                run.checkpoint = dict(checkpoint)
                run.budget = dict(budget)
                await session.commit()
                stage = "searching"
                continue

            if stage == "searching":
                queries = [str(query) for query in checkpoint.get("queries", [])]
                run.phase = "searching"
                _emit_once(
                    session,
                    run,
                    checkpoint,
                    "search.started",
                    f"Searching with {len(queries)} queries for candidate sources.",
                    {"queries": len(queries)},
                )
                run.checkpoint = dict(checkpoint)
                await session.commit()

                retrieval = SourceRetrievalStage(search, fetcher)
                found: list[dict[str, Any]] = []
                seen_urls: set[str] = set()
                for query in queries:
                    retrieved = await retrieval.run({"query": query, "limit": 5})
                    budget["searchCalls"] = int(budget.get("searchCalls", 0)) + 1
                    budget["fetchedSources"] = int(budget.get("fetchedSources", 0)) + len(retrieved)
                    for candidate_source in retrieved:
                        if candidate_source.url in seen_urls:
                            continue
                        seen_urls.add(candidate_source.url)
                        found.append(candidate_source.model_dump())

                run.phase = "fetching"
                for source in found:
                    if source.get("status") == "retrieved":
                        _emit_once(
                            session,
                            run,
                            checkpoint,
                            f"source.retrieved:{source['url']}",
                            f"Retrieved source: {source.get('title') or source['domain']}.",
                            {"domain": source["domain"], "quality": source["quality"]},
                        )
                    else:
                        _emit_once(
                            session,
                            run,
                            checkpoint,
                            f"source.unavailable:{source['url']}",
                            (
                                f"Source unavailable: {source['domain']}. "
                                "The page could not be opened."
                            ),
                            {"domain": source["domain"]},
                        )
                retrieved_count = sum(1 for source in found if source.get("status") == "retrieved")
                _emit_once(
                    session,
                    run,
                    checkpoint,
                    "search.completed",
                    f"Search complete: {retrieved_count} of {len(found)} candidate pages opened.",
                    {"results": retrieved_count, "queries": len(queries)},
                )

                checkpoint["sources"] = found
                checkpoint["stage"] = "extracting"
                run.phase = "extracting"
                run.checkpoint = dict(checkpoint)
                run.budget = dict(budget)
                await session.commit()
                stage = "extracting"
                continue

            if stage == "extracting":
                run.phase = "extracting"
                await session.commit()

                extraction = RequirementExtractionStage(model)
                candidates: list[dict[str, Any]] = []
                reachable = [
                    source
                    for source in checkpoint.get("sources", [])
                    if source.get("status") == "retrieved"
                ]
                for source in reachable:
                    from .types import RetrievedSource

                    proposed = await extraction.run(
                        {"source": RetrievedSource.model_validate(source)}
                    )
                    budget["modelCalls"] = int(budget.get("modelCalls", 0)) + 1
                    candidates.extend(candidate.model_dump() for candidate in proposed)

                checkpoint["requirements"] = candidates
                checkpoint["stage"] = "matching"
                _emit_once(
                    session,
                    run,
                    checkpoint,
                    "requirements.extracted",
                    f"Extracted {len(candidates)} requirements from {len(reachable)} sources.",
                    {"candidates": len(candidates)},
                )
                run.phase = "evaluating"
                run.checkpoint = dict(checkpoint)
                run.budget = dict(budget)
                await session.commit()
                stage = "matching"
                continue

            if stage == "matching":
                run.phase = "evaluating"
                await session.commit()

                candidates, matches, profile, protected = await _assessment_inputs(
                    session, run.owner_id, criteria
                )
                decided = await ConfirmedProfileMatchingStage().run(
                    {
                        "opportunities": candidates,
                        "matches": matches,
                        "profile": profile,
                        "protectedProfile": protected,
                    }
                )

                decisions = list(decided["requirements"])
                met = sum(
                    1 for decision in decisions if decision.status in {"likely", "verified", "met"}
                )
                failed = sum(
                    1 for decision in decisions if decision.status in {"ineligible", "failed"}
                )
                unresolved = len(decisions) - met - failed

                # A candidate needs verification when at least one of its
                # requirements stayed unresolved against confirmed facts.
                needing_verification = 0
                offset = 0
                for candidate in candidates:
                    count = len(candidate.get("requirements", []))
                    slice_ = decisions[offset : offset + count]
                    offset += count
                    if any(decision.status == "unresolved" for decision in slice_):
                        needing_verification += 1

                unconfirmed = await _unconfirmed_facts(session, run.owner_id)
                unconfirmed_keys = {fact.key for fact in unconfirmed}
                blocked = sum(
                    1
                    for candidate in candidates
                    for requirement in candidate.get("requirements", [])
                    if requirement.get("profileFactKey") in unconfirmed_keys
                )

                _emit_once(
                    session,
                    run,
                    checkpoint,
                    "eligibility.evaluated",
                    (
                        f"Checked {len(decisions)} requirements against your confirmed "
                        f"profile: {met} satisfied, {unresolved} unresolved, {failed} not met."
                    ),
                    {"met": met, "unresolved": unresolved, "failed": failed},
                )
                if unconfirmed and blocked:
                    _emit_once(
                        session,
                        run,
                        checkpoint,
                        "profile.needs_confirmation",
                        (
                            f"{len(unconfirmed)} of your facts are not confirmed yet, "
                            f"so {blocked} requirements could not be resolved."
                        ),
                        {"facts": len(unconfirmed), "blockedRequirements": blocked},
                    )

                checkpoint["assessment"] = {
                    "candidatesFound": len(candidates),
                    "needingVerification": needing_verification,
                    "candidateIds": [candidate["id"] for candidate in candidates],
                }
                checkpoint["stage"] = "explaining"
                run.checkpoint = dict(checkpoint)
                run.budget = dict(budget)
                await session.commit()
                stage = "explaining"
                continue

            # stage == "explaining"
            run.phase = "saving"
            await session.commit()

            from .types import RequirementCandidate

            explanation = await EvidenceGroundedExplanationStage(model).run(
                {
                    "requirements": [
                        RequirementCandidate.model_validate(entry)
                        for entry in checkpoint.get("requirements", [])
                    ],
                    "sources": [
                        {
                            "id": source["id"],
                            "title": source["title"],
                            "excerpt": as_untrusted(str(source.get("excerpt", ""))),
                        }
                        for source in checkpoint.get("sources", [])
                        if source.get("status") == "retrieved"
                    ],
                }
            )
            budget["modelCalls"] = int(budget.get("modelCalls", 0)) + 1
            if explanation.unsupported:
                _emit_once(
                    session,
                    run,
                    checkpoint,
                    "provider.warning",
                    (
                        f"{len(explanation.unsupported)} statements were dropped because "
                        "no source supported them."
                    ),
                    {"dropped": len(explanation.unsupported)},
                )

            checkpoint["stage"] = "done"
            await _complete_run(session, run, checkpoint, budget)
            return

    except Exception as error:
        from .providers.base import ProviderError

        if isinstance(error, ProviderError):
            code, message, retryable = error.code, str(error), error.retryable
        else:
            code, message, retryable = (
                "UNKNOWN",
                "Something went wrong while the run was working. The stage can be retried.",
                True,
            )
            logger.error(
                "run_stage_failed",
                {"run_id": run.id, "stage": stage, "error": type(error).__name__},
            )
        # Whatever this pass spent is spent, finished or not.
        run.budget = dict(budget)
        await _fail_run(
            session,
            run,
            checkpoint,
            code=code,
            message=message,
            retryable=retryable,
            worker_id=worker_id,
        )


def _finish_pass(budget: dict[str, Any], pass_started: float) -> float:
    """Adds this pass's wall clock to the budget, and starts the next one."""
    budget["elapsedSeconds"] = int(budget.get("elapsedSeconds", 0)) + int(
        time.monotonic() - pass_started
    )
    return time.monotonic()


async def _complete_run(
    session: AsyncSession, run: Run, checkpoint: dict[str, Any], budget: dict[str, Any]
) -> None:
    """The terminal state of a run that finished its walk."""
    now = datetime.now(UTC)
    sources = checkpoint.get("sources", [])
    reviewed = sum(1 for source in sources if source.get("status") == "retrieved")
    unreachable = sum(1 for source in sources if source.get("status") != "retrieved")
    assessment = checkpoint.get("assessment", {})

    summary = {
        "sourcesReviewed": reviewed,
        "candidatesFound": int(assessment.get("candidatesFound", 0)),
        "needingVerification": int(assessment.get("needingVerification", 0)),
        "unreachable": unreachable,
    }

    parts = [
        f"Reviewed {reviewed} accessible sources.",
        f"Found {summary['candidatesFound']} candidate opportunities.",
    ]
    if summary["needingVerification"]:
        parts.append(f"{summary['needingVerification']} need eligibility verification.")
    if unreachable:
        parts.append(f"{unreachable} sources could not be reached.")

    _emit_once(
        session,
        run,
        checkpoint,
        "run.completed",
        " ".join(parts),
        {
            "sourcesReviewed": reviewed,
            "candidatesFound": summary["candidatesFound"],
            "unreachable": unreachable,
        },
    )

    run.summary = summary
    run.budget = dict(budget)
    run.status = "completed"
    run.phase = "done"
    run.finished_at = now
    run.error = None
    run.claimed_by = None
    run.lease_expires_at = None
    run.checkpoint = dict(checkpoint)
    await session.commit()


# --------------------------------------------------------------------- #
# The loop                                                               #
# --------------------------------------------------------------------- #


async def run_once(*, worker_id: str | None = None, settings: Settings | None = None) -> bool:
    """Claims at most one run and walks it. Whether it found one."""
    resolved = settings or get_settings()
    identity = worker_id or f"worker-{uuid.uuid4().hex[:8]}"

    from ..db.session import session_factory

    async with session_factory() as session:
        run = await claim_run(session, worker_id=identity, lease_seconds=resolved.run_lease_seconds)
        if run is None:
            return False
        await process_run(session, run, settings=resolved, worker_id=identity)
        return True


async def worker_loop(stop: asyncio.Event, *, settings: Settings, worker_id: str) -> None:
    """Claims, works, waits — until the application is shutting down.

    The loop survives anything a run can do: a failed claim is logged and
    the next tick tries again, because one bad run is not a reason for
    the worker to die.
    """
    logger.info("worker_started", {"worker_id": worker_id})
    while not stop.is_set():
        try:
            worked = await run_once(worker_id=worker_id, settings=settings)
        except Exception:
            logger.error("worker_tick_failed", {"worker_id": worker_id})
            worked = False

        if not worked:
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(stop.wait(), timeout=settings.worker_poll_seconds)
    logger.info("worker_stopped", {"worker_id": worker_id})
