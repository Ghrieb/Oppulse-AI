"""The profile.

Everything the student has told us about themselves, and the decisions
about what may be used.

Two rules run through this module:

- **a fact is only a fact once it is confirmed** — an unconfirmed fact
  never resolves an eligibility requirement;
- **the date of birth is not a fact** — it lives in the protected section,
  behind its own endpoint, and it is only ever used to check an age rule.

Changing a fact re-evaluates every opportunity, because the conclusions
change with it.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.rules.matching import build_impact, recompute_all
from ..db.models import (
    AuditLog,
    Profile,
    ProfileFact,
    ProfileFactRevision,
    ProtectedProfile,
)
from ..db.session import get_session
from ..errors import not_found, validation
from ..security.session import CurrentUser, current_user
from ..wire import WireModel
from .idempotency import idempotency_key, remember, replay_if_seen

router = APIRouter(prefix="/profile", tags=["profile"])


# --------------------------------------------------------------------- #
# The wire shapes                                                      #
# --------------------------------------------------------------------- #


class FactSource(WireModel):
    """Where an extracted value came from.

    The three fields the contract requires are always present when there is
    a source at all: a source without a document is not a source.
    """

    document_id: str
    document_name: str
    excerpt: str
    page_reference: str | None = None
    section: str | None = None


class ProfileFactOut(WireModel):
    id: str
    key: str
    label: str
    value: str
    numeric_value: float | None = None
    code: str | None = None
    status: str
    excluded: bool
    corrected: bool
    conflicting: bool
    source: FactSource | None = None
    section: str
    used_for: str | None = None
    confidence: str
    #: The conflicting value, when there is one. Never resolved silently.
    conflict: dict[str, Any] | None = None
    created_at: str
    updated_at: str | None = None


class EmailPreferenceOut(WireModel):
    default_cadence: str
    categories: dict[str, str]


class PreferencesOut(WireModel):
    guided_view: bool
    email: EmailPreferenceOut
    timezone: str
    currency: str
    cv_notes: list[str] = Field(default_factory=list)


class ConsentOut(WireModel):
    external_model_processing: bool
    allow_profile_matching: bool
    email_notifications: bool
    retention_days: int | None = None


class ProfileOut(WireModel):
    id: str
    full_name: str
    email: str
    avatar_url: str | None = None
    headline: str | None = None
    facts: list[ProfileFactOut]
    preferences: PreferencesOut
    consent: ConsentOut
    updated_at: str


class UpdateProfileRequest(WireModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    preferences: dict[str, Any] | None = None
    consent: dict[str, Any] | None = None


class UpdateFactRequest(WireModel):
    status: str | None = None
    value: str | None = Field(default=None, max_length=500)
    excluded: bool | None = None


class RevisionOut(WireModel):
    id: str
    fact_id: str
    fact_label: str
    action: str
    previous_value: str | None = None
    new_value: str | None = None
    source_document_name: str | None = None
    created_at: str


class ImpactRequirementOut(WireModel):
    opportunity_id: str
    opportunity_title: str
    requirement_id: str
    requirement_label: str
    status: str


class ImpactEntryOut(WireModel):
    fact_key: str
    requirements: list[ImpactRequirementOut]


class UpdateFactResponse(WireModel):
    fact: ProfileFactOut
    revisions: list[RevisionOut]
    impact: list[ImpactEntryOut]


class RevisionsOut(WireModel):
    revisions: list[RevisionOut]


class ImpactOut(WireModel):
    impact: list[ImpactEntryOut]


class SnapshotOut(WireModel):
    id: str
    created_at: str
    facts: list[ProfileFactOut]


class DateOfBirthOut(WireModel):
    value: str | None = None
    status: str
    source: str | None = None
    updated_at: str
    excluded_from_ai_context: bool


class ProtectedProfileOut(WireModel):
    """The protected section, in the shape the contract lists."""

    protected_profile: ProtectedSectionOut


class ProtectedSectionOut(WireModel):
    date_of_birth: DateOfBirthOut


class UpdateProtectedProfileRequest(WireModel):
    date_of_birth: str | None = None
    date_of_birth_status: str | None = None
    source: str | None = None
    excluded_from_ai_context: bool | None = None


# --------------------------------------------------------------------- #
# Helpers                                                              #
# --------------------------------------------------------------------- #


def _fact_out(fact: ProfileFact) -> ProfileFactOut:
    """A fact, in the shape the frontend parses."""
    return ProfileFactOut(
        id=fact.id,
        key=fact.key,
        label=fact.label,
        value=fact.value,
        numeric_value=fact.numeric_value,
        code=fact.code,
        status=fact.status,
        excluded=fact.excluded,
        corrected=fact.corrected,
        conflicting=fact.conflicting,
        source=(
            FactSource(
                document_id=fact.source_document_id or "",
                document_name=fact.source_document_name or "",
                excerpt=fact.source_excerpt or "",
                page_reference=fact.source_page,
                section=fact.source_section,
            )
            if fact.source_document_id and fact.source_document_name
            else None
        ),
        section=fact.section,
        used_for=fact.used_for or None,
        confidence=fact.confidence,
        conflict=None,
        created_at=_iso(fact.created_at),
        updated_at=_iso(fact.updated_at),
    )


def _iso(value: datetime | None) -> str:
    if value is None:
        return datetime.now(UTC).isoformat()
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC).isoformat()
    return value.isoformat()


def _preferences_out(raw: dict[str, Any]) -> PreferencesOut:
    """The preferences, with the email block filled in."""
    preferences = raw or {}
    email = preferences.get("email") or {}
    categories = email.get("categories") or {}

    return PreferencesOut(
        guided_view=bool(preferences.get("guidedView", True)),
        email=EmailPreferenceOut(
            default_cadence=str(email.get("defaultCadence", "daily_digest")),
            categories={str(key): str(value) for key, value in categories.items()},
        ),
        timezone=str(preferences.get("timezone", "UTC")),
        currency=str(preferences.get("currency", "EUR")),
        cv_notes=list(preferences.get("cvNotes", [])),
    )


def _consent_out(raw: dict[str, Any]) -> ConsentOut:
    consent = raw or {}
    retention = consent.get("retentionDays")

    return ConsentOut(
        external_model_processing=bool(consent.get("externalModelProcessing", False)),
        allow_profile_matching=bool(consent.get("allowProfileMatching", True)),
        email_notifications=bool(consent.get("emailNotifications", False)),
        retention_days=int(retention) if isinstance(retention, int) else None,
    )


async def _profile_for(session: AsyncSession, user: CurrentUser) -> Profile | None:
    """The caller's profile."""
    result = await session.execute(select(Profile).where(Profile.user_id == user.id))
    return result.scalar_one_or_none()


async def _protected_for(session: AsyncSession, user: CurrentUser) -> ProtectedProfile:
    """The caller's protected section, created on first use."""
    result = await session.execute(
        select(ProtectedProfile).where(ProtectedProfile.owner_id == user.id)
    )
    record = result.scalar_one_or_none()
    if record is not None:
        return record

    record = ProtectedProfile(
        owner_id=user.id,
        date_of_birth_status="not_provided",
        date_of_birth_updated_at=datetime.now(UTC),
    )
    session.add(record)
    await session.flush()
    return record


async def _recompute(session: AsyncSession, profile: Profile, protected: ProtectedProfile) -> None:
    """Re-evaluates every opportunity, because the conclusions changed."""
    from ..db.models import Match, Opportunity

    opportunities = list((await session.execute(select(Opportunity))).scalars().all())
    matches = list((await session.execute(select(Match))).scalars().all())
    facts = list(
        (await session.execute(select(ProfileFact).where(ProfileFact.profile_id == profile.id)))
        .scalars()
        .all()
    )

    recomputed = recompute_all(
        [opportunity.__dict__ for opportunity in opportunities],
        [match.__dict__ for match in matches],
        _profile_dict(profile, facts),
        _protected_dict(protected),
    )

    for opportunity, payload in zip(opportunities, recomputed["opportunities"], strict=False):
        opportunity.requirements = payload["requirements"]
    for match, payload in zip(matches, recomputed["matches"], strict=False):
        match.eligibility = payload["eligibility"]
        match.warnings = payload["warnings"]
        match.confidence = payload["confidence"]
        match.fit_score = payload.get("fit_score", match.fit_score)


def _profile_dict(profile: Profile, facts: list[ProfileFact]) -> dict[str, Any]:
    """The profile, in the shape the rule engine reads."""
    return {
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
                "source": (
                    {
                        "documentName": fact.source_document_name,
                        "excerpt": fact.source_excerpt,
                        "pageReference": fact.source_page,
                        "section": fact.source_section,
                    }
                    if fact.source_document_name
                    else None
                ),
            }
            for fact in facts
        ],
    }


def _protected_dict(protected: ProtectedProfile) -> dict[str, Any]:
    return {
        "dateOfBirth": {
            "value": protected.date_of_birth,
            "status": protected.date_of_birth_status,
            "source": protected.date_of_birth_source,
            "updatedAt": _iso(protected.date_of_birth_updated_at),
            "excludedFromAiContext": protected.excluded_from_ai_context,
        }
    }


# --------------------------------------------------------------------- #
# The routes                                                           #
# --------------------------------------------------------------------- #


@router.get("", response_model=ProfileOut)
@router.get("/", response_model=ProfileOut, include_in_schema=False)
async def read_profile(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileOut:
    """The caller's profile."""
    profile = await _profile_for(session, user)
    if profile is None:
        raise not_found("Your profile")

    facts = list(
        (await session.execute(select(ProfileFact).where(ProfileFact.profile_id == profile.id)))
        .scalars()
        .all()
    )

    return ProfileOut(
        id=profile.id,
        full_name=profile.full_name,
        email=profile.email,
        avatar_url=profile.avatar_url,
        headline=profile.headline,
        facts=[_fact_out(fact) for fact in facts],
        preferences=_preferences_out(profile.preferences),
        consent=_consent_out(profile.consent),
        updated_at=_iso(profile.updated_at),
    )


@router.patch("", response_model=ProfileOut)
@router.patch("/", response_model=ProfileOut, include_in_schema=False)
async def update_profile(
    body: UpdateProfileRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileOut:
    """Changes the name, the preferences or the consent."""
    profile = await _profile_for(session, user)
    if profile is None:
        raise not_found("Your profile")

    if body.full_name is not None:
        profile.full_name = body.full_name

    if body.preferences is not None:
        merged = dict(profile.preferences or {})
        for key, value in body.preferences.items():
            if key == "email" and isinstance(value, dict):
                email = dict(merged.get("email") or {})
                email.update(value)
                categories = dict(email.get("categories") or {})
                categories.update(value.get("categories") or {})
                email["categories"] = categories
                merged["email"] = email
            else:
                merged[key] = value
        profile.preferences = merged

    if body.consent is not None:
        merged_consent = dict(profile.consent or {})
        merged_consent.update(body.consent)
        profile.consent = merged_consent

    profile.updated_at = datetime.now(UTC)
    session.add(
        AuditLog(
            owner_id=user.id,
            actor=user.id,
            event="profile.updated",
            detail={"consent": sorted(body.consent or {})},
        )
    )
    await session.commit()

    return await read_profile(user=user, session=session)


@router.patch("/facts/{id}", response_model=UpdateFactResponse)
async def update_fact(
    id: str,
    body: UpdateFactRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    key: str | None = Depends(idempotency_key),
) -> UpdateFactResponse:
    """Confirms, corrects, rejects or excludes one fact.

    It is not just a write: it changes what the agent can conclude, so every
    opportunity is re-evaluated and the history is recorded.
    """
    scope = f"profile.fact.update:{id}"
    stored = await replay_if_seen(session, owner_id=user.id, scope=scope, key=key)
    if stored is not None:
        return UpdateFactResponse.model_validate(stored)

    profile = await _profile_for(session, user)
    if profile is None:
        raise not_found("Your profile")

    result = await session.execute(
        select(ProfileFact).where(ProfileFact.id == id, ProfileFact.profile_id == profile.id)
    )
    fact = result.scalar_one_or_none()
    if fact is None:
        raise not_found("That fact")

    previous_value = fact.value
    action = "updated"

    if body.status is not None:
        if body.status not in {"confirmed", "rejected"}:
            raise validation(
                "A fact can only be confirmed or rejected.",
                {"status": ["Use 'confirmed' or 'rejected'."]},
            )
        fact.status = body.status
        action = body.status

    if body.value is not None:
        fact.value = body.value
        fact.corrected = True
        action = "corrected"

    if body.excluded is not None:
        fact.excluded = body.excluded
        action = "excluded" if body.excluded else "restored"

    fact.updated_at = datetime.now(UTC)

    revision = ProfileFactRevision(
        owner_id=user.id,
        fact_id=fact.id,
        fact_label=fact.label,
        action=action,
        previous_value=previous_value,
        new_value=fact.value,
        source_document_name=fact.source_document_name,
        created_at=fact.updated_at,
    )
    session.add(revision)

    protected = await _protected_for(session, user)
    await _recompute(session, profile, protected)
    await session.commit()

    revisions = list(
        (
            await session.execute(
                select(ProfileFactRevision)
                .where(ProfileFactRevision.owner_id == user.id)
                .order_by(ProfileFactRevision.created_at.desc())
            )
        )
        .scalars()
        .all()
    )

    from ..db.models import Opportunity

    opportunities = list((await session.execute(select(Opportunity))).scalars().all())
    impact = build_impact([opportunity.__dict__ for opportunity in opportunities])

    out = UpdateFactResponse(
        fact=_fact_out(fact),
        revisions=[
            RevisionOut(
                id=entry.id,
                fact_id=entry.fact_id,
                fact_label=entry.fact_label,
                action=entry.action,
                previous_value=entry.previous_value,
                new_value=entry.new_value,
                source_document_name=entry.source_document_name,
                created_at=_iso(entry.created_at),
            )
            for entry in revisions
        ],
        impact=[
            ImpactEntryOut(
                fact_key=entry["factKey"],
                requirements=[
                    ImpactRequirementOut(
                        opportunity_id=requirement["opportunityId"],
                        opportunity_title=requirement["opportunityTitle"],
                        requirement_id=requirement["requirementId"],
                        requirement_label=requirement["requirementLabel"],
                        status=requirement["status"],
                    )
                    for requirement in entry["requirements"]
                ],
            )
            for entry in impact
        ],
    )
    await remember(
        session, owner_id=user.id, scope=scope, key=key, body=out.model_dump(by_alias=True)
    )
    return out


@router.get("/impact", response_model=ImpactOut)
async def read_impact(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ImpactOut:
    """What each fact is holding up."""
    from ..db.models import Opportunity

    opportunities = list((await session.execute(select(Opportunity))).scalars().all())
    impact = build_impact([opportunity.__dict__ for opportunity in opportunities])

    return ImpactOut(
        impact=[
            ImpactEntryOut(
                fact_key=entry["factKey"],
                requirements=[
                    ImpactRequirementOut(
                        opportunity_id=requirement["opportunityId"],
                        opportunity_title=requirement["opportunityTitle"],
                        requirement_id=requirement["requirementId"],
                        requirement_label=requirement["requirementLabel"],
                        status=requirement["status"],
                    )
                    for requirement in entry["requirements"]
                ],
            )
            for entry in impact
        ]
    )


@router.get("/revisions", response_model=RevisionsOut)
async def read_revisions(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> RevisionsOut:
    """Every change the student made, newest first."""
    revisions = list(
        (
            await session.execute(
                select(ProfileFactRevision)
                .where(ProfileFactRevision.owner_id == user.id)
                .order_by(ProfileFactRevision.created_at.desc())
            )
        )
        .scalars()
        .all()
    )

    return RevisionsOut(
        revisions=[
            RevisionOut(
                id=entry.id,
                fact_id=entry.fact_id,
                fact_label=entry.fact_label,
                action=entry.action,
                previous_value=entry.previous_value,
                new_value=entry.new_value,
                source_document_name=entry.source_document_name,
                created_at=_iso(entry.created_at),
            )
            for entry in revisions
        ]
    )


@router.get("/snapshots/latest", response_model=SnapshotOut)
async def read_latest_snapshot(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> SnapshotOut:
    """The profile as it was when the last run started."""
    profile = await _profile_for(session, user)
    if profile is None:
        raise not_found("Your profile")

    facts = list(
        (await session.execute(select(ProfileFact).where(ProfileFact.profile_id == profile.id)))
        .scalars()
        .all()
    )

    return SnapshotOut(
        id=profile.id,
        created_at=_iso(profile.updated_at),
        facts=[_fact_out(fact) for fact in facts],
    )


# --------------------------------------------------------------------- #
# The protected section                                                #
# --------------------------------------------------------------------- #


@router.get("/protected", response_model=ProtectedProfileOut)
async def read_protected_profile(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ProtectedProfileOut:
    """The protected section.

    It is a separate endpoint on purpose: a routine profile read never
    returns the date of birth, so it cannot leak into a list view, a log or
    a prompt.
    """
    protected = await _protected_for(session, user)
    await session.commit()

    return ProtectedProfileOut(
        protected_profile=ProtectedSectionOut(date_of_birth=_date_of_birth_out(protected))
    )


@router.patch("/protected", response_model=ProtectedProfileOut)
async def update_protected_profile(
    body: UpdateProtectedProfileRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ProtectedProfileOut:
    """Changes the date of birth, or withdraws it.

    Changing it re-evaluates every opportunity, because the age
    requirements change with it.
    """
    protected = await _protected_for(session, user)
    now = datetime.now(UTC)

    if body.date_of_birth is not None:
        if body.date_of_birth:
            parsed = _parse_date(body.date_of_birth)
            if parsed is None:
                raise validation(
                    "That date cannot be right.",
                    {"dateOfBirth": ["Use YYYY-MM-DD, and a real date that is not in the future."]},
                )
            protected.date_of_birth = body.date_of_birth
            protected.date_of_birth_status = body.date_of_birth_status or "provided"
        else:
            protected.date_of_birth = None
            protected.date_of_birth_status = body.date_of_birth_status or "excluded"

    if body.date_of_birth_status is not None and body.date_of_birth is None:
        protected.date_of_birth_status = body.date_of_birth_status
        if body.date_of_birth_status in {"declined", "excluded", "not_provided"}:
            protected.date_of_birth = None

    if body.source is not None:
        protected.date_of_birth_source = body.source

    if body.excluded_from_ai_context is not None:
        protected.excluded_from_ai_context = body.excluded_from_ai_context

    protected.date_of_birth_updated_at = now
    protected.updated_at = now

    profile = await _profile_for(session, user)
    if profile is not None:
        await _recompute(session, profile, protected)

    session.add(
        AuditLog(
            owner_id=user.id,
            actor=user.id,
            event="protected.updated",
            detail={"status": protected.date_of_birth_status},
        )
    )
    await session.commit()

    return ProtectedProfileOut(
        protected_profile=ProtectedSectionOut(date_of_birth=_date_of_birth_out(protected))
    )


def _date_of_birth_out(protected: ProtectedProfile) -> DateOfBirthOut:
    return DateOfBirthOut(
        value=protected.date_of_birth,
        status=protected.date_of_birth_status,
        source=protected.date_of_birth_source,
        updated_at=_iso(protected.date_of_birth_updated_at),
        excluded_from_ai_context=protected.excluded_from_ai_context,
    )


def _parse_date(value: str) -> str | None:
    """A real date that is not in the future."""
    import re

    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", value.strip())
    if not match:
        return None

    try:
        parsed = datetime.strptime(value.strip(), "%Y-%m-%d").replace(tzinfo=UTC)
    except ValueError:
        return None

    if parsed > datetime.now(UTC):
        return None

    return parsed.strftime("%Y-%m-%d")
