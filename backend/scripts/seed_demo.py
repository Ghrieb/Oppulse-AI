"""Seeds the demo data.

The frontend's fixtures are the demo world, and they are exported to
``contracts/demo-fixtures.json`` so there is one source of truth. This
script loads that file and writes it into the database, so the real service
starts from the same world the prototype does.

    uv run python scripts/seed_demo.py

It is idempotent: running it twice does not double anything.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "contracts" / "demo-fixtures.json"

sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import select  # noqa: E402

from app.ai.rules.matching import recompute_all  # noqa: E402
from app.db.models import (  # noqa: E402
    Alert,
    Application,
    Document,
    Draft,
    Match,
    Mission,
    MonitorEvent,
    MonitorTarget,
    Opportunity,
    Profile,
    ProfileFact,
    ProtectedProfile,
    Run,
    RunEvent,
    Source,
    User,
)
from app.db.session import Base, engine, session_factory  # noqa: E402
from app.security.tokens import hash_password  # noqa: E402

DEMO_PASSWORD = "PrototypePass1"  # noqa: S105 - the demo password, published on purpose


def _now() -> datetime:
    return datetime.now(UTC)


def _when(value: str | None) -> datetime | None:
    """A timestamp from the fixtures, or nothing."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


async def seed() -> None:
    if not FIXTURES.exists():
        raise SystemExit(
            f"{FIXTURES} is missing. Export it first: cd frontend && npm run fixtures:export"
        )

    payload = json.loads(FIXTURES.read_text(encoding="utf-8"))

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        user_payload = payload["user"]

        user = User(
            id=user_payload["id"],
            email=user_payload["email"],
            full_name=user_payload["fullName"],
            password_hash=hash_password(DEMO_PASSWORD),
            email_verified=True,
            email_verified_at=_now(),
        )
        session.add(user)

        profile_payload = payload["profile"]
        profile = Profile(
            id=profile_payload["id"],
            user_id=user.id,
            full_name=profile_payload["fullName"],
            email=profile_payload["email"],
            headline=profile_payload.get("headline"),
            preferences=profile_payload.get("preferences", {}),
            consent=profile_payload.get("consent", {}),
        )
        session.add(profile)

        session.add(
            ProtectedProfile(
                owner_id=user.id,
                date_of_birth_status="not_provided",
                date_of_birth_updated_at=_now(),
            )
        )

        for fact in profile_payload.get("facts", []):
            session.add(
                ProfileFact(
                    id=fact["id"],
                    profile_id=profile.id,
                    key=fact["key"],
                    label=fact["label"],
                    value=fact["value"],
                    numeric_value=fact.get("numericValue"),
                    code=fact.get("code"),
                    status=fact.get("status", "proposed"),
                    excluded=bool(fact.get("excluded", False)),
                    corrected=bool(fact.get("corrected", False)),
                    conflicting=bool(fact.get("conflicting", False)),
                    source_document_id=(fact.get("source") or {}).get("documentId"),
                    source_document_name=(fact.get("source") or {}).get("documentName"),
                    source_excerpt=(fact.get("source") or {}).get("excerpt"),
                    source_page=(fact.get("source") or {}).get("pageReference"),
                    source_section=(fact.get("source") or {}).get("section"),
                    confidence=fact.get("confidence", "medium"),
                    section=fact.get("section", "about"),
                    used_for=fact.get("usedFor", ""),
                )
            )

        for document in payload.get("documents", []):
            session.add(
                Document(
                    id=document["id"],
                    owner_id=user.id,
                    filename=document["filename"],
                    mime_type=document["mimeType"],
                    size_bytes=document.get("sizeBytes", 0),
                    category=document.get("category", "other"),
                    status=document.get("status", "processed"),
                    consent_to_use=bool(document.get("consentToUse", False)),
                    error_message=document.get("errorMessage"),
                    extraction=document.get("extraction", {}),
                )
            )

        for source in payload.get("sources", []):
            session.add(
                Source(
                    id=source["id"],
                    run_id=source.get("runId"),
                    url=source["url"],
                    title=source["title"],
                    domain=source["domain"],
                    excerpt=source.get("excerpt", ""),
                    quality=source.get("quality", "unknown"),
                    status=source.get("status", "retrieved"),
                    content_hash=source.get("contentHash"),
                    retrieved_at=(
                        source.get("retrievedAt") and datetime.fromisoformat(source["retrievedAt"])
                    )
                    or _now(),
                    page_reference=source.get("pageReference"),
                )
            )

        from app.db.models import Evidence

        for evidence in payload.get("evidence", []):
            session.add(
                Evidence(
                    id=evidence["id"],
                    source_id=evidence["sourceId"],
                    opportunity_id=evidence.get("opportunityId"),
                    claim=evidence["claim"],
                    excerpt=evidence.get("excerpt", ""),
                    page_reference=evidence.get("pageReference"),
                    url=evidence.get("url", ""),
                    retrieved_at=(
                        evidence.get("retrievedAt")
                        and datetime.fromisoformat(evidence["retrievedAt"])
                    )
                    or _now(),
                    quality=evidence.get("quality", "unknown"),
                    stance=evidence.get("stance", "supports"),
                    confidence=evidence.get("confidence", "medium"),
                )
            )

        for opportunity in payload.get("opportunities", []):
            session.add(
                Opportunity(
                    id=opportunity["id"],
                    title=opportunity["title"],
                    institution=opportunity["institution"],
                    type=opportunity.get("type", "other"),
                    country=opportunity.get("country", {}),
                    source_domain=opportunity.get("sourceDomain", ""),
                    canonical_url=opportunity.get("canonicalUrl", ""),
                    summary=opportunity.get("summary", ""),
                    institution_brand=opportunity.get("institutionBrand", {}),
                    duration=opportunity.get("duration"),
                    application_opens_at=opportunity.get("applicationOpensAt"),
                    tags=opportunity.get("tags", []),
                    deadline=opportunity.get("deadline", {}),
                    additional_deadlines=opportunity.get("additionalDeadlines", []),
                    funding=opportunity.get("funding", {}),
                    requirements=opportunity.get("requirements", []),
                    saved=bool(opportunity.get("saved", False)),
                    dismissed=bool(opportunity.get("dismissed", False)),
                )
            )

        for match in payload.get("matches", []):
            session.add(
                Match(
                    id=match["id"],
                    opportunity_id=match["opportunityId"],
                    profile_id=profile.id,
                    fit_score=match.get("fitScore", 0),
                    eligibility=match.get("eligibility", "unresolved"),
                    warnings=match.get("warnings", []),
                    confidence=match.get("confidence", "medium"),
                    reasons=match.get("reasons", []),
                )
            )

        for mission in payload.get("missions", []):
            session.add(
                Mission(
                    id=mission["id"],
                    owner_id=user.id,
                    title=mission["title"],
                    objective=mission["objective"],
                    criteria=mission.get("criteria", {}),
                    status=mission.get("status", "active"),
                    source=mission.get("source", "onboarding"),
                    selected_document_ids=mission.get("selectedDocumentIds", []),
                    confirmed_fact_ids=mission.get("confirmedFactIds", []),
                    limitations=mission.get("limitations", []),
                    user_confirmed_at=(
                        mission.get("userConfirmedAt")
                        and datetime.fromisoformat(mission["userConfirmedAt"])
                    )
                    or None,
                    monitoring=mission.get("monitoring", {}),
                    latest_run_id=mission.get("latestRunId"),
                )
            )

        for run in payload.get("runs", []):
            session.add(
                Run(
                    id=run["id"],
                    mission_id=run["missionId"],
                    owner_id=user.id,
                    status=run.get("status", "completed"),
                    phase=run.get("phase", "done"),
                    summary=run.get("summary"),
                    error=run.get("error"),
                    budget=run.get("budgetUsed", {}),
                    started_at=_when(run.get("startedAt")),
                    finished_at=_when(run.get("finishedAt")),
                )
            )

        for event in payload.get("runEvents", []):
            session.add(
                RunEvent(
                    id=event["id"],
                    run_id=event["runId"],
                    type=event["type"],
                    message=event["message"],
                    data=event.get("data"),
                    created_at=_when(event.get("createdAt")) or _now(),
                )
            )

        for application in payload.get("applications", []):
            session.add(
                Application(
                    id=application["id"],
                    owner_id=user.id,
                    opportunity_id=application["opportunityId"],
                    opportunity_title=application["opportunityTitle"],
                    institution=application["institution"],
                    status=application.get("status", "considering"),
                    deadline=application.get("deadline"),
                    deadline_verified=bool(application.get("deadlineVerified", False)),
                    checklist=application.get("checklist", []),
                    tasks=application.get("tasks", []),
                    draft_ids=application.get("draftIds", []),
                    completion=application.get("completion", {}),
                    next_best_action=application.get("nextBestAction"),
                    official_url=application.get("officialUrl"),
                    notes=application.get("notes"),
                )
            )

        for draft in payload.get("drafts", []):
            session.add(
                Draft(
                    id=draft["id"],
                    owner_id=user.id,
                    application_id=draft["applicationId"],
                    opportunity_id=draft["opportunityId"],
                    type=draft["type"],
                    title=draft["title"],
                    current_version=draft.get("currentVersion", 1),
                    content=draft.get("content", ""),
                    versions=draft.get("versions", []),
                    pending_proposal=draft.get("pendingProposal"),
                )
            )

        for target in payload.get("monitorTargets", []):
            session.add(
                MonitorTarget(
                    id=target["id"],
                    owner_id=user.id,
                    target_type=target["targetType"],
                    target_id=target.get("targetId"),
                    label=target["label"],
                    url=target.get("url"),
                    frequency=target.get("frequency", "daily"),
                    status=target.get("status", "active"),
                    last_successful_check_at=(
                        target.get("lastSuccessfulCheckAt")
                        and datetime.fromisoformat(target["lastSuccessfulCheckAt"])
                    )
                    or None,
                    next_scheduled_check_at=(
                        target.get("nextScheduledCheckAt")
                        and datetime.fromisoformat(target["nextScheduledCheckAt"])
                    )
                    or None,
                    events_detected=target.get("eventsDetected", 0),
                    source_unreachable=bool(target.get("sourceUnreachable", False)),
                )
            )

        for event in payload.get("monitorEvents", []):
            session.add(
                MonitorEvent(
                    id=event["id"],
                    owner_id=user.id,
                    monitor_target_id=event["monitorTargetId"],
                    type=event["type"],
                    what_changed=event["whatChanged"],
                    why_it_matters=event["whyItMatters"],
                    recommended_action=event["recommendedAction"],
                    detected_at=datetime.fromisoformat(event["detectedAt"]),
                    source_url=event["sourceUrl"],
                    previous_hash=event.get("previousHash"),
                    content_hash=event.get("contentHash", ""),
                    is_test_event=bool(event.get("isTestEvent", False)),
                )
            )

        for alert in payload.get("alerts", []):
            session.add(
                Alert(
                    id=alert["id"],
                    owner_id=user.id,
                    monitor_event_id=alert.get("monitorEventId"),
                    title=alert["title"],
                    body=alert["body"],
                    severity=alert.get("severity", "info"),
                    category=alert.get("category", "source_change"),
                    sensitivity=alert.get("sensitivity", "routine"),
                    delivery=alert.get("delivery", {}),
                    read=bool(alert.get("read", False)),
                )
            )

        await session.flush()

        # The conclusions are recomputed against the seeded profile, so the
        # demo starts in a state the rule engine agrees with.
        opportunities = list((await session.execute(select(Opportunity))).scalars().all())
        matches = list((await session.execute(select(Match))).scalars().all())
        facts = list((await session.execute(select(ProfileFact))).scalars().all())

        recomputed = recompute_all(
            [opportunity.__dict__ for opportunity in opportunities],
            [match.__dict__ for match in matches],
            {
                "id": profile.id,
                "fullName": profile.full_name,
                "email": profile.email,
                "facts": [
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
                    for fact in facts
                ],
            },
            None,
        )

        for opportunity, updated in zip(opportunities, recomputed["opportunities"], strict=False):
            opportunity.requirements = updated["requirements"]
        for match, updated in zip(matches, recomputed["matches"], strict=False):
            match.eligibility = updated["eligibility"]
            match.warnings = updated["warnings"]
            match.confidence = updated["confidence"]
            match.fit_score = updated.get("fit_score", match.fit_score)

        await session.commit()

    print(f"Seeded the demo student ({payload['user']['email']} / {DEMO_PASSWORD}).")


async def main() -> None:
    await seed()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
