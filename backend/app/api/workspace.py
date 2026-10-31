"""The workspace.

The applications a student is working on, and the documents Oppulse has
prepared for them.

A draft is never applied without the student: the agent proposes, the
student reviews the diff and accepts, and acceptance creates a new version
with the old one still recoverable.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Application, Draft
from ..db.session import get_session
from ..errors import conflict, not_found
from ..security.session import CurrentUser, current_user
from ..wire import WireModel
from .idempotency import idempotency_key, remember, replay_if_seen

router = APIRouter(tags=["workspace"])


# --------------------------------------------------------------------- #
# The wire shapes                                                      #
# --------------------------------------------------------------------- #


class ChecklistItemOut(WireModel):
    id: str
    label: str
    status: str
    source: str | None = None
    due_date: str | None = None
    document_id: str | None = None
    note: str | None = None


class TaskOut(WireModel):
    id: str
    label: str
    status: str
    due_date: str | None = None
    blocked_reason: str | None = None


class CompletionOut(WireModel):
    completed: int = 0
    total: int = 0


class ApplicationOut(WireModel):
    id: str
    opportunity_id: str
    opportunity_title: str
    institution: str
    status: str
    deadline: str | None = None
    deadline_verified: bool = False
    checklist: list[ChecklistItemOut] = Field(default_factory=list)
    tasks: list[TaskOut] = Field(default_factory=list)
    draft_ids: list[str] = Field(default_factory=list)
    completion: CompletionOut = Field(default_factory=CompletionOut)
    next_best_action: str | None = None
    official_url: str | None = None
    notes: str | None = None
    created_at: str
    updated_at: str


class ApplicationListOut(WireModel):
    applications: list[ApplicationOut] = Field(default_factory=list)


class UpdateApplicationRequest(WireModel):
    status: str | None = None
    notes: str | None = Field(default=None, max_length=4000)
    tasks: list[dict[str, Any]] | None = None


class VersionOut(WireModel):
    version: int
    content: str
    created_at: str
    source: str
    summary: str | None = None


class ProposalOut(WireModel):
    id: str
    draft_id: str
    base_version: int
    content: str
    summary: str
    unsupported_claims: list[str] = Field(default_factory=list)
    status: str
    created_at: str


class DraftOut(WireModel):
    id: str
    application_id: str
    opportunity_id: str
    type: str
    title: str
    current_version: int
    content: str
    versions: list[VersionOut] = Field(default_factory=list)
    pending_proposal: ProposalOut | None = None
    created_at: str
    updated_at: str


class DraftListOut(WireModel):
    drafts: list[DraftOut] = Field(default_factory=list)


class UpdateDraftRequest(WireModel):
    content: str
    base_version: int | None = None


class CreateDraftRequest(WireModel):
    type: str


class CreateProposalRequest(WireModel):
    instruction: str = Field(min_length=1, max_length=2000)
    selected_text: str | None = None


# --------------------------------------------------------------------- #
# Helpers                                                              #
# --------------------------------------------------------------------- #


def _iso(value: datetime | None) -> str:
    if value is None:
        return datetime.now(UTC).isoformat()
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC).isoformat()
    return value.isoformat()


def _application_out(application: Application) -> ApplicationOut:
    return ApplicationOut(
        id=application.id,
        opportunity_id=application.opportunity_id,
        opportunity_title=application.opportunity_title,
        institution=application.institution,
        status=application.status,
        deadline=application.deadline,
        deadline_verified=application.deadline_verified,
        checklist=[ChecklistItemOut(**item) for item in application.checklist],
        tasks=[TaskOut(**task) for task in application.tasks],
        draft_ids=list(application.draft_ids),
        completion=CompletionOut(**(application.completion or {})),
        next_best_action=application.next_best_action,
        official_url=application.official_url,
        notes=application.notes,
        created_at=_iso(application.created_at),
        updated_at=_iso(application.updated_at),
    )


def _draft_out(draft: Draft) -> DraftOut:
    proposal = draft.pending_proposal
    return DraftOut(
        id=draft.id,
        application_id=draft.application_id,
        opportunity_id=draft.opportunity_id,
        type=draft.type,
        title=draft.title,
        current_version=draft.current_version,
        content=draft.content,
        versions=[
            VersionOut(
                version=version.get("version", 1),
                content=version.get("content", ""),
                created_at=version.get("createdAt", ""),
                source=version.get("source", "user"),
                summary=version.get("summary"),
            )
            for version in draft.versions
        ],
        pending_proposal=(
            ProposalOut(
                id=proposal.get("id", ""),
                draft_id=proposal.get("draftId", draft.id),
                base_version=proposal.get("baseVersion", draft.current_version),
                content=proposal.get("content", ""),
                summary=proposal.get("summary", ""),
                unsupported_claims=list(proposal.get("unsupportedClaims", [])),
                status=proposal.get("status", "pending"),
                created_at=proposal.get("createdAt", ""),
            )
            if proposal
            else None
        ),
        created_at=_iso(draft.created_at),
        updated_at=_iso(draft.updated_at),
    )


async def _owned_application(
    session: AsyncSession, user: CurrentUser, application_id: str
) -> Application:
    result = await session.execute(
        select(Application).where(Application.id == application_id, Application.owner_id == user.id)
    )
    application = result.scalar_one_or_none()
    if application is None:
        raise not_found("That application")
    return application


async def _owned_draft(session: AsyncSession, user: CurrentUser, draft_id: str) -> Draft:
    result = await session.execute(
        select(Draft).where(Draft.id == draft_id, Draft.owner_id == user.id)
    )
    draft = result.scalar_one_or_none()
    if draft is None:
        raise not_found("That draft")
    return draft


# --------------------------------------------------------------------- #
# The applications                                                     #
# --------------------------------------------------------------------- #


@router.get("/applications", response_model=ApplicationListOut)
async def list_applications(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ApplicationListOut:
    """The caller's applications."""
    result = await session.execute(
        select(Application)
        .where(Application.owner_id == user.id)
        .order_by(Application.updated_at.desc())
    )

    return ApplicationListOut(
        applications=[_application_out(item) for item in result.scalars().all()]
    )


@router.get("/applications/{id}", response_model=ApplicationOut)
async def read_application(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ApplicationOut:
    """One application."""
    return _application_out(await _owned_application(session, user, id))


@router.patch("/applications/{id}", response_model=ApplicationOut)
async def update_application(
    id: str,
    body: UpdateApplicationRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ApplicationOut:
    """Changes an application's status, its notes or its tasks."""
    application = await _owned_application(session, user, id)

    if body.status is not None:
        application.status = body.status
    if body.notes is not None:
        application.notes = body.notes
    if body.tasks is not None:
        application.tasks = list(body.tasks)

    application.updated_at = datetime.now(UTC)
    await session.commit()

    return _application_out(application)


@router.get("/applications/{id}/drafts", response_model=DraftListOut)
async def list_application_drafts(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DraftListOut:
    """The documents prepared for one application."""
    await _owned_application(session, user, id)

    result = await session.execute(
        select(Draft)
        .where(Draft.application_id == id, Draft.owner_id == user.id)
        .order_by(Draft.updated_at.desc())
    )

    return DraftListOut(drafts=[_draft_out(draft) for draft in result.scalars().all()])


@router.post("/applications/{id}/drafts", response_model=DraftOut, status_code=201)
async def create_application_draft(
    id: str,
    body: CreateDraftRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DraftOut:
    """Starts a document for an application.

    It is a starting point grounded in the confirmed facts, and it is never
    applied without the student.
    """
    application = await _owned_application(session, user, id)

    from ..ai.providers import build_runtime_model_provider
    from ..ai.providers.replay import ReplayCorpus
    from ..ai.stages.draft import DraftProposalStage
    from ..config import get_settings
    from ..db.models import Profile, ProfileFact

    profile_result = await session.execute(select(Profile).where(Profile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()

    facts: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    if profile is not None:
        fact_rows = list(
            (await session.execute(select(ProfileFact).where(ProfileFact.profile_id == profile.id)))
            .scalars()
            .all()
        )
        for fact in fact_rows:
            entry = {
                "id": fact.id,
                "key": fact.key,
                "label": fact.label,
                "value": fact.value,
            }
            if fact.status == "confirmed" and not fact.excluded:
                facts.append(entry)
            elif fact.excluded:
                excluded.append(entry)

    model = build_runtime_model_provider(get_settings(), ReplayCorpus())
    proposal = await DraftProposalStage(model).run(
        {
            "instruction": f"Write a {body.type.replace('_', ' ')} for this application.",
            "confirmedFacts": facts,
            "excludedFacts": excluded,
            "documentType": body.type,
        }
    )

    now = datetime.now(UTC)
    draft = Draft(
        owner_id=user.id,
        application_id=application.id,
        opportunity_id=application.opportunity_id,
        type=body.type,
        title=f"{body.type.replace('_', ' ')} — {application.opportunity_title}",
        current_version=1,
        content=proposal.content,
        versions=[
            {
                "version": 1,
                "content": proposal.content,
                "createdAt": now.isoformat(),
                "source": "created",
                "summary": "A starting point grounded in your confirmed facts.",
            }
        ],
        pending_proposal=None,
    )
    session.add(draft)
    await session.flush()

    application.draft_ids = [*application.draft_ids, draft.id]
    application.updated_at = now
    await session.commit()

    return _draft_out(draft)


# --------------------------------------------------------------------- #
# The drafts                                                           #
# --------------------------------------------------------------------- #


@router.get("/drafts/{id}", response_model=DraftOut)
async def read_draft(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DraftOut:
    """One document."""
    return _draft_out(await _owned_draft(session, user, id))


@router.patch("/drafts/{id}", response_model=DraftOut)
async def update_draft(
    id: str,
    body: UpdateDraftRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DraftOut:
    """Saves an edit as a new version.

    The previous version stays recoverable, and a stale edit is refused
    rather than silently overwriting someone else's work.
    """
    draft = await _owned_draft(session, user, id)

    if body.base_version is not None and body.base_version != draft.current_version:
        raise conflict(
            "This document changed since you opened it. Reload it, and apply your edit again."
        )

    now = datetime.now(UTC)
    draft.current_version += 1
    draft.content = body.content
    draft.versions = [
        *draft.versions,
        {
            "version": draft.current_version,
            "content": body.content,
            "createdAt": now.isoformat(),
            "source": "user",
            "summary": "Your edit.",
        },
    ]
    draft.updated_at = now
    await session.commit()

    return _draft_out(draft)


@router.get("/drafts/{id}/versions", response_model=list[VersionOut])
async def list_draft_versions(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[VersionOut]:
    """Every version of a document, oldest first."""
    draft = await _owned_draft(session, user, id)

    return [
        VersionOut(
            version=version.get("version", 1),
            content=version.get("content", ""),
            created_at=version.get("createdAt", ""),
            source=version.get("source", "user"),
            summary=version.get("summary"),
        )
        for version in draft.versions
    ]


@router.post("/drafts/{id}/proposals", response_model=ProposalOut, status_code=201)
async def create_proposal(
    id: str,
    body: CreateProposalRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    key: str | None = Depends(idempotency_key),
) -> ProposalOut:
    """Asks the assistant to propose a revision.

    The proposal is a *proposal*: it does not touch the document, and the
    student reviews the diff before accepting it.
    """
    scope = f"drafts.proposal.create:{id}"
    stored = await replay_if_seen(session, owner_id=user.id, scope=scope, key=key)
    if stored is not None:
        return ProposalOut.model_validate(stored)

    draft = await _owned_draft(session, user, id)

    from ..ai.providers import build_runtime_model_provider
    from ..ai.providers.replay import ReplayCorpus
    from ..ai.stages.draft import DraftProposalStage
    from ..config import get_settings

    model = build_runtime_model_provider(get_settings(), ReplayCorpus())
    proposal = await DraftProposalStage(model).run(
        {
            "instruction": body.instruction,
            "confirmedFacts": [],
            "excludedFacts": [],
            "documentType": draft.type,
        }
    )

    now = datetime.now(UTC)
    record = {
        "id": f"70000000-0000-4000-8000-{now.strftime('%Y%m%d%H%M%S%f')[:12]}",
        "draftId": draft.id,
        "baseVersion": draft.current_version,
        "content": proposal.content,
        "summary": f"Proposed revision: {body.instruction}",
        "unsupportedClaims": list(proposal.unsupported_claims),
        "status": "pending",
        "createdAt": now.isoformat(),
    }
    draft.pending_proposal = record
    draft.updated_at = now
    await session.commit()

    out = ProposalOut.model_validate(record)
    await remember(
        session, owner_id=user.id, scope=scope, key=key, body=out.model_dump(by_alias=True)
    )
    return out


@router.post("/drafts/{id}/proposals/{proposalId}/accept", response_model=DraftOut)
async def accept_proposal(
    id: str,
    proposalId: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    key: str | None = Depends(idempotency_key),
) -> DraftOut:
    """Accepts a proposal, as a new version.

    The previous version stays recoverable, and the acceptance is recorded.
    """
    scope = f"drafts.proposal.accept:{id}:{proposalId}"
    stored = await replay_if_seen(session, owner_id=user.id, scope=scope, key=key)
    if stored is not None:
        return DraftOut.model_validate(stored)

    draft = await _owned_draft(session, user, id)

    proposal = draft.pending_proposal
    if not proposal or proposal.get("id") != proposalId:
        raise not_found("That proposal")

    now = datetime.now(UTC)
    draft.current_version += 1
    draft.content = proposal.get("content", draft.content)
    draft.versions = [
        *draft.versions,
        {
            "version": draft.current_version,
            "content": draft.content,
            "createdAt": now.isoformat(),
            "source": "ai_accepted",
            "summary": proposal.get("summary"),
        },
    ]
    draft.pending_proposal = None
    draft.updated_at = now
    await session.commit()

    out = _draft_out(draft)
    await remember(
        session, owner_id=user.id, scope=scope, key=key, body=out.model_dump(by_alias=True)
    )
    return out


@router.post("/drafts/{id}/proposals/{proposalId}/reject", response_model=DraftOut)
async def reject_proposal(
    id: str,
    proposalId: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    key: str | None = Depends(idempotency_key),
) -> DraftOut:
    """Discards a proposal. The document is unchanged."""
    scope = f"drafts.proposal.reject:{id}:{proposalId}"
    stored = await replay_if_seen(session, owner_id=user.id, scope=scope, key=key)
    if stored is not None:
        return DraftOut.model_validate(stored)

    draft = await _owned_draft(session, user, id)

    proposal = draft.pending_proposal
    if not proposal or proposal.get("id") != proposalId:
        raise not_found("That proposal")

    draft.pending_proposal = None
    draft.updated_at = datetime.now(UTC)
    await session.commit()

    out = _draft_out(draft)
    await remember(
        session, owner_id=user.id, scope=scope, key=key, body=out.model_dump(by_alias=True)
    )
    return out
