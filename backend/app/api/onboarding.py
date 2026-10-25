"""The onboarding.

One draft, server-owned, so a refresh resumes exactly where the student
left off — and so another device sees the same answers.

The draft carries the starting intent, the reference link, the uploaded
document and its processing state and consent, the current question, and
every answer with where it came from.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Mission, ProtectedProfile, Run, RunEvent
from ..db.session import get_session
from ..errors import validation
from ..security.session import CurrentUser, current_user
from ..wire import WireModel
from .idempotency import idempotency_key, remember, replay_if_seen

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

#: The id of the draft a student starts with.
DRAFT_ID = "d1000000-0000-4000-8000-000000000001"


class AnswerOut(WireModel):
    question_id: str
    value: Any
    answered_at: str
    source: str
    fact_key: str | None = None
    note: str | None = None


class DraftOut(WireModel):
    id: str
    intent: str | None = None
    reference_url: str | None = None
    answers: list[AnswerOut] = Field(default_factory=list)
    uploaded_document_id: str | None = None
    uploaded_document_status: str | None = None
    uploaded_document_consent: bool | None = None
    current_question_id: str | None = None
    completed: bool = False
    updated_at: str


class DraftResponseOut(WireModel):
    draft: DraftOut


class CompleteRequest(WireModel):
    draft: DraftOut


class CompleteResponseOut(WireModel):
    mission: dict[str, str]
    run_id: str | None = None


@router.get("/draft", response_model=DraftResponseOut)
async def read_draft(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DraftResponseOut:
    """The student's draft."""
    return DraftResponseOut(draft=await _draft_for(session, user))


@router.put("/draft", response_model=DraftResponseOut)
async def save_draft(
    body: DraftOut,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DraftResponseOut:
    """Saves the draft.

    Every answer is saved as it is given, so a refresh — or a lost
    connection — never costs the student their answers.
    """
    stored = await _store_draft(session, user, body)
    await session.commit()

    return DraftResponseOut(draft=stored)


@router.post("/complete", response_model=CompleteResponseOut)
async def complete_onboarding(
    body: CompleteRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    key: str | None = Depends(idempotency_key),
) -> CompleteResponseOut:
    """Turns the answers into a mission, and starts the run.

    The date of birth goes to the **protected** section — never into a fact,
    never into the mission — because it is used for one thing only.
    """
    scope = "onboarding.complete"
    stored = await replay_if_seen(session, owner_id=user.id, scope=scope, key=key)
    if stored is not None:
        return CompleteResponseOut.model_validate(stored)

    if not body.draft.answers:
        raise validation(
            "Answer at least one question before starting research.",
            {"draft": ["The draft is empty."]},
        )

    now = datetime.now(UTC)

    age_answer = next(
        (answer for answer in body.draft.answers if answer.question_id == "age"), None
    )
    if age_answer is not None and isinstance(age_answer.value, str):
        await _store_date_of_birth(session, user, age_answer.value, now)

    mission = Mission(
        owner_id=user.id,
        title="My search",
        objective="Find opportunities that fit my confirmed profile.",
        criteria={},
        status="active",
        source="onboarding",
        selected_document_ids=(
            [body.draft.uploaded_document_id] if body.draft.uploaded_document_id else []
        ),
        confirmed_fact_ids=[],
        limitations=[],
        user_confirmed_at=now,
        monitoring={"enabled": True, "frequency": "daily"},
    )
    session.add(mission)
    await session.flush()

    run = Run(
        mission_id=mission.id,
        owner_id=user.id,
        status="queued",
        phase="queued",
        budget={},
        started_at=now,
    )
    session.add(run)
    await session.flush()

    session.add(
        RunEvent(
            run_id=run.id,
            type="run.queued",
            message="The run is queued.",
            data={"missionId": mission.id},
            created_at=now,
        )
    )
    mission.latest_run_id = run.id
    await session.commit()

    out = CompleteResponseOut(
        mission={"id": mission.id, "title": mission.title, "objective": mission.objective},
        run_id=run.id,
    )
    await remember(
        session, owner_id=user.id, scope=scope, key=key, body=out.model_dump(by_alias=True)
    )
    return out


# --------------------------------------------------------------------- #
# The draft                                                            #
# --------------------------------------------------------------------- #


async def _draft_for(session: AsyncSession, user: CurrentUser) -> DraftOut:
    """The draft, from the store the service keeps for the student."""
    from ..db.models import OnboardingDraftRow

    result = await session.execute(
        select(OnboardingDraftRow).where(OnboardingDraftRow.owner_id == user.id)
    )
    row = result.scalar_one_or_none()
    if row is not None and row.draft:
        return DraftOut.model_validate(row.draft)

    return DraftOut(
        id=DRAFT_ID,
        intent=None,
        reference_url=None,
        answers=[],
        uploaded_document_id=None,
        uploaded_document_status=None,
        uploaded_document_consent=None,
        current_question_id="goal",
        completed=False,
        updated_at=datetime.now(UTC).isoformat(),
    )


async def _store_draft(session: AsyncSession, user: CurrentUser, draft: DraftOut) -> DraftOut:
    """Saves the draft."""
    from ..db.models import OnboardingDraftRow

    result = await session.execute(
        select(OnboardingDraftRow).where(OnboardingDraftRow.owner_id == user.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        row = OnboardingDraftRow(owner_id=user.id, draft={})
        session.add(row)
        await session.flush()

    row.draft = draft.model_dump(mode="json")
    row.updated_at = datetime.now(UTC)
    return draft


async def _store_date_of_birth(
    session: AsyncSession, user: CurrentUser, value: str, now: datetime
) -> None:
    """Puts the date of birth in the protected section.

    It is not a fact, it is not in the mission, and it is only ever used to
    check an age rule.
    """
    result = await session.execute(
        select(ProtectedProfile).where(ProtectedProfile.owner_id == user.id)
    )
    protected = result.scalar_one_or_none()
    if protected is None:
        protected = ProtectedProfile(owner_id=user.id, date_of_birth_status="not_provided")
        session.add(protected)
        await session.flush()

    if value == "prefer_not_to_say":
        protected.date_of_birth = None
        protected.date_of_birth_status = "declined"
    else:
        protected.date_of_birth = value
        protected.date_of_birth_status = "provided"

    protected.date_of_birth_source = "onboarding"
    protected.date_of_birth_updated_at = now
    protected.updated_at = now
