"""The assistant.

The conversation is **server-owned**: the backend keeps the thread, and each
turn records the context it ran with, so the harness can check that an
excluded document stayed excluded and that a corrected fact replaced the
old value.

The answers are blocks, not paragraphs: evidence with its sources, a
checklist, a document to start, a run in progress, or an action the student
must confirm. Nothing is sent on the student's behalf.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..ai.context import assemble_turn_context
from ..ai.providers.base import ModelProvider
from ..ai.stages.draft import DraftProposalStage
from ..ai.stages.explanation import EvidenceGroundedExplanationStage
from ..ai.stages.institution import InstitutionAnswerStage
from ..ai.stages.mission import MissionInterpretationStage
from ..ai.stages.requirements import RequirementExtractionStage
from ..ai.stages.retrieval import SourceRetrievalStage
from ..ai.thread import create_thread, history, record_turn
from ..ai.types import (
    AssistantBlock,
    AssistantBlockAdapter,
    MediaContext,
    RetrievedSource,
)
from ..config import get_settings
from ..db.models import (
    Application,
    Document,
    Draft,
    Mission,
    Opportunity,
    Profile,
    ProfileFact,
    ProtectedProfile,
)
from ..db.session import get_session
from ..errors import not_found, validation
from ..security.session import CurrentUser, current_user
from ..wire import WireModel, iso_utc

router = APIRouter(prefix="/assistant", tags=["assistant"])


# --------------------------------------------------------------------- #
# The wire shapes                                                      #
# --------------------------------------------------------------------- #


class ContextOut(WireModel):
    mission_id: str | None = None
    opportunity_id: str | None = None
    application_id: str | None = None
    draft_id: str | None = None
    document_ids: list[str] = Field(default_factory=list)
    fact_ids: list[str] = Field(default_factory=list)


class MessageOut(WireModel):
    id: str
    role: str
    content: str
    created_at: str
    blocks: list[dict[str, Any]] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


class HistoryOut(WireModel):
    messages: list[MessageOut] = Field(default_factory=list)


class MessageRequest(WireModel):
    message: str = Field(min_length=1, max_length=4000)
    context: dict[str, Any] | None = None
    selected_text: str | None = None


class ResponseOut(WireModel):
    """The assistant's answer.

    The blocks are typed, so a block the service produces is checked before
    it leaves — and the OpenAPI document describes every kind, which is what
    makes the contract check able to compare the two sides.
    """

    blocks: list[AssistantBlock] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


class ActionRequest(WireModel):
    action: str
    context: dict[str, Any] | None = None
    payload: dict[str, Any] | None = None


class ActionResponseOut(WireModel):
    block: dict[str, Any]
    route: str | None = None
    created_id: str | None = None


# --------------------------------------------------------------------- #
# The routes                                                           #
# --------------------------------------------------------------------- #


@router.get("/history", response_model=HistoryOut)
async def read_history(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> HistoryOut:
    """The conversation.

    The frontend keeps a copy so a refresh is instant; this is the copy that
    decides what a turn may use.
    """
    turns = await history(session, owner_id=user.id)

    return HistoryOut(
        messages=[
            MessageOut(
                id=turn.id,
                role=turn.role,
                content=turn.content,
                created_at=iso_utc(turn.created_at) or "",
                blocks=list(turn.blocks or []),
                context=dict(turn.context or {}),
            )
            for turn in turns
        ]
    )


@router.post("/messages", response_model=ResponseOut)
async def send_message(
    body: MessageRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ResponseOut:
    """Asks the assistant something.

    The context is assembled here, and only here: the client says *what* it
    selected, and the service decides what may be read.
    """
    request_context = body.context or {}

    profile = await _profile(session, user)
    protected = await _protected(session, user)
    documents = list(
        (
            await session.execute(
                select(Document).where(Document.owner_id == user.id, Document.status != "deleted")
            )
        )
        .scalars()
        .all()
    )
    mission = await _mission(session, user, request_context.get("missionId"))
    opportunity = await _opportunity(session, request_context.get("opportunityId"))
    application = await _application(session, user, request_context.get("applicationId"))

    context = assemble_turn_context(
        profile=profile,
        protected_profile=protected,
        documents=[document.__dict__ for document in documents],
        mission=mission.__dict__ if mission is not None else None,
        opportunity=opportunity.__dict__ if opportunity is not None else None,
        request=request_context,
    )

    thread = await _thread(session, user, mission)
    await record_turn(
        session,
        thread=thread,
        role="user",
        content=body.message,
        context=context,
    )

    blocks, suggestions = await _answer(
        session,
        user=user,
        body=body,
        context=context,
        mission=mission,
        opportunity=opportunity,
        application=application,
    )

    # Every block is checked against the union before it leaves, so a
    # malformed answer fails here rather than in the browser.
    typed_blocks = [AssistantBlockAdapter.validate_python(block) for block in blocks]

    await record_turn(
        session,
        thread=thread,
        role="assistant",
        content="",
        context=context,
        blocks=[block.model_dump(by_alias=True, mode="json") for block in typed_blocks],
    )
    await session.commit()

    return ResponseOut(
        blocks=typed_blocks,
        suggestions=suggestions,
        context=context.to_record(),
    )


@router.post("/actions", response_model=ActionResponseOut)
async def run_action(
    body: ActionRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponseOut:
    """Runs an action the assistant offered.

    Everything that creates state is confirmed by the student first: the
    interface asks, and only then does this endpoint run.
    """
    payload = body.payload or {}
    context = body.context or {}

    if body.action == "create_draft":
        return await _create_draft(session, user=user, payload=payload, context=context)
    if body.action == "create_checklist":
        return await _create_checklist(session, user=user, context=context)
    if body.action == "start_run":
        return await _start_run(session, user=user, context=context)
    if body.action == "open_route":
        return ActionResponseOut(
            block={"kind": "text", "text": "Here is where you can continue."},
            route=str(payload.get("route", "/home")),
            created_id=None,
        )

    raise validation(
        "That action is not one the assistant can run.",
        {"action": ["Unknown action."]},
    )


# --------------------------------------------------------------------- #
# The answer                                                           #
# --------------------------------------------------------------------- #


async def _answer(
    session: AsyncSession,
    *,
    user: CurrentUser,
    body: MessageRequest,
    context: Any,
    mission: Mission | None,
    opportunity: Opportunity | None,
    application: Application | None,
) -> tuple[list[dict[str, Any]], list[str]]:
    """The blocks and the suggestions for one turn.

    The stages run behind the configured providers: offline they answer from
    the recorded corpus the worker runs from, with a key they reason for
    real. Either way the *decisions* are the deterministic ones.
    """
    from ..ai.providers import (
        build_fetcher,
        build_model_provider,
        build_search_provider,
    )
    from ..ai.worker import run_corpus

    settings = get_settings()
    corpus = run_corpus()
    model = build_model_provider(settings, corpus)
    search = build_search_provider(settings, corpus)
    fetcher = build_fetcher(settings, corpus)

    blocks: list[dict[str, Any]] = []
    suggestions: list[str] = []

    criteria = (mission.criteria if mission is not None else {}) or {}
    mission_proposal = await MissionInterpretationStage(model).run(
        {
            "goal": body.message,
            "allowedScope": {
                "destinations": criteria.get("destinations", []),
                "destinationCountries": criteria.get("destinationCountries", []),
            },
            "confirmedFacts": context.facts,
        }
    )
    blocks.append(
        {
            "kind": "text",
            "text": mission_proposal.objective
            or "Tell me what you are looking for and I will research it.",
        }
    )

    # The application the student is working in, when they asked from inside
    # one. The answer keeps pointing at that workspace instead of pretending
    # the question was asked from nowhere.
    if application is not None:
        blocks.append(
            {
                "kind": "action",
                "label": f"Continue {application.opportunity_title or 'this application'}",
                "description": (
                    "Open the workspace for this application — the checklist, the drafts "
                    "and the next step."
                ),
                "action": "open_route",
                "payload": {"route": f"/applications/{application.id}"},
                "effect": "prepares",
            }
        )

    if opportunity is not None:
        retrieved = await SourceRetrievalStage(search, fetcher).run(
            {"query": body.message, "limit": 5}
        )
        requirements = []
        for source in retrieved:
            if source.status != "retrieved":
                continue
            requirements.extend(await RequirementExtractionStage(model).run({"source": source}))

        explanation = await EvidenceGroundedExplanationStage(model).run(
            {
                "requirements": requirements,
                "sources": [
                    {"id": source.id, "title": source.title, "excerpt": source.excerpt}
                    for source in retrieved
                ],
            }
        )

        blocks.append(
            {
                "kind": "evidence",
                "title": (opportunity.title or "")[:120] or "What the source says",
                "summary": explanation.summary,
                "sources": [
                    {
                        "title": source.title,
                        "url": source.url,
                        "quote": source.excerpt[:400],
                        "quality": source.quality,
                    }
                    for source in retrieved
                    if source.status == "retrieved"
                ],
                "requirementId": None,
            }
        )
        blocks.append(
            {
                "kind": "checklist",
                "title": f"What {opportunity.title or 'this call'} requires",
                "items": [
                    {
                        "label": requirement.label,
                        "status": (
                            "ready" if requirement.verification == "verified" else "needs_attention"
                        ),
                        "detail": requirement.clause,
                        "route": None,
                    }
                    for requirement in requirements
                ],
            }
        )

        official = [
            source
            for source in retrieved
            if source.quality == "official" and source.status == "retrieved"
        ]
        media = _media_from(official)

        blocks.append(_opportunity_reference(opportunity))
        blocks.append(await _institution_block(model, opportunity, official, media))
        if media:
            blocks.append(
                {
                    "kind": "media_context",
                    "subject": f"What the official page for {opportunity.title} shows",
                    "media": [item.model_dump(by_alias=True, mode="json") for item in media],
                }
            )
        blocks.append(_unknown_block(opportunity=opportunity, retrieved=retrieved))

        blocks.append(
            {
                "kind": "action",
                "label": f"Open {opportunity.title}",
                "description": "See the full analysis, the evidence and the deadline.",
                "action": "open_opportunity",
                "payload": {"opportunityId": opportunity.id},
                "effect": "prepares",
            }
        )
        suggestions = [
            "What did the source actually say?",
            "What is still unresolved?",
            "Draft an inquiry to the programme",
        ]
    else:
        suggestions = [
            "Find fully funded opportunities for me",
            "Analyse a link I paste in",
        ]

    return blocks, suggestions


# --------------------------------------------------------------------- #
# The block builders                                                    #
# --------------------------------------------------------------------- #


def _media_from(sources: list[RetrievedSource]) -> list[MediaContext]:
    """The media on the official pages that were actually opened.

    Only pages of official quality contribute — there is no media discovery,
    ADR-A26 — and an entry sitting on an official page is labelled official.
    Two pages embedding the same video name it once.
    """
    entries: list[MediaContext] = []
    seen: set[str] = set()

    for source in sources:
        for item in source.media:
            if item.url in seen:
                continue
            seen.add(item.url)
            entries.append(item.model_copy(update={"source_type": "official"}))

    return entries


def _opportunity_reference(opportunity: Opportunity) -> dict[str, Any]:
    """A pointer to the call the answer rests on, so the message need not repeat it."""
    return {
        "kind": "opportunity_reference",
        "opportunityId": opportunity.id,
        "title": opportunity.title,
        "institution": opportunity.institution,
        "country": str((opportunity.country or {}).get("name", "")),
        "reason": "This is the call the answer is based on. Open it for the full evidence.",
    }


async def _institution_block(
    model: ModelProvider,
    opportunity: Opportunity,
    official: list[RetrievedSource],
    media: list[MediaContext],
) -> dict[str, Any]:
    """The institution answer: the model proposes the prose, the rest is assembled here."""
    country = str((opportunity.country or {}).get("name", ""))
    proposal = await InstitutionAnswerStage(model).run(
        {
            "institution": opportunity.institution,
            "programme": opportunity.title,
            "summary": opportunity.summary,
            "country": country,
            "reached": [source.title for source in official],
        }
    )

    return {
        "kind": "institution",
        "description": proposal.description,
        "location": opportunity.institution,
        "country": country,
        "institutionType": None,
        "programmeContext": opportunity.summary or None,
        "evidence": [
            {
                "title": source.title,
                "url": source.url,
                "quote": source.excerpt[:220],
                "sourceType": "official",
            }
            for source in official[:2]
        ],
        "media": [item.model_dump(by_alias=True, mode="json") for item in media],
        "unverified": list(proposal.unverified),
        "action": "Check your eligibility against the requirements below.",
    }


def _unknown_block(*, opportunity: Opportunity, retrieved: list[RetrievedSource]) -> dict[str, Any]:
    """What could not be verified: the disagreement or the gap, and the next step.

    A conflict is the one the deadline record already holds — two sources
    disagreed, and that was recorded. A source that could not be opened is a
    gap. A question nothing was retrieved for says so, rather than
    pretending an answer exists.
    """
    checked = list(dict.fromkeys(source.title or source.url for source in retrieved))
    conflicts = list((opportunity.deadline or {}).get("conflicts") or [])
    unavailable = [source for source in retrieved if source.status == "unavailable"]

    if conflicts:
        question = (
            "Two sources give different closing dates for this call, so the application "
            "window is not yet known."
        )
        next_action = "Open the call and check the date before you plan around it."
        conflict = True
    elif unavailable:
        question = (
            f"{unavailable[0].title or unavailable[0].url} could not be opened, so what it "
            "states stays unknown rather than absent."
        )
        next_action = "Open the source yourself, or ask Oppulse to try it again."
        conflict = False
    elif not retrieved:
        question = (
            "Nothing has been retrieved for this question yet, so it is unknown rather "
            "than answered."
        )
        next_action = "Paste the official link, or ask Oppulse to research it first."
        conflict = False
    else:
        question = (
            "The pages that were reached do not state everything; what they leave unsaid "
            "stays unknown rather than estimated."
        )
        next_action = "Open the source yourself, or ask a more specific question."
        conflict = False

    return {
        "kind": "unknown_or_conflict",
        "question": question,
        "checked": checked,
        "nextAction": next_action,
        "conflict": conflict,
    }


# --------------------------------------------------------------------- #
# The actions                                                          #
# --------------------------------------------------------------------- #


async def _create_draft(
    session: AsyncSession,
    *,
    user: CurrentUser,
    payload: dict[str, Any],
    context: dict[str, Any],
) -> ActionResponseOut:
    """Starts a document.

    It is a draft: nothing is sent, and the student reviews it before
    anything else happens.
    """
    from ..ai.providers import build_model_provider
    from ..ai.worker import run_corpus

    draft_type = str(payload.get("draftType", "motivation_letter"))
    application_id = context.get("applicationId")

    application = None
    if application_id:
        result = await session.execute(
            select(Application).where(
                Application.id == application_id, Application.owner_id == user.id
            )
        )
        application = result.scalar_one_or_none()

    if application is None:
        raise validation(
            "Save the opportunity to your workspace first, then I can draft for it.",
            {"applicationId": ["This application was not found."]},
        )

    settings = get_settings()
    model = build_model_provider(settings, run_corpus())
    proposal = await DraftProposalStage(model).run(
        {
            "instruction": f"Write a {draft_type.replace('_', ' ')} for this application.",
            "confirmedFacts": [],
            "excludedFacts": [],
            "documentType": draft_type,
        }
    )

    draft = Draft(
        owner_id=user.id,
        application_id=application.id,
        opportunity_id=application.opportunity_id,
        type=draft_type,
        title=f"{draft_type.replace('_', ' ')} — {application.opportunity_title}",
        current_version=1,
        content=proposal.content,
        versions=[
            {
                "version": 1,
                "content": proposal.content,
                "createdAt": datetime.now(UTC).isoformat(),
                "source": "created",
                "summary": "A starting point. Edit it before you send it.",
            }
        ],
        pending_proposal=None,
    )
    session.add(draft)
    await session.flush()

    application.draft_ids = [*application.draft_ids, draft.id]
    await session.commit()

    return ActionResponseOut(
        block={
            "kind": "draft_action",
            "title": "Your draft is ready",
            "description": (
                "It is a starting point grounded in your confirmed facts. Review it, edit it, and "
                "export it yourself."
            ),
            "draftType": draft_type,
            "applicationId": application.id,
            "effect": "prepares",
        },
        route=f"/writing/{draft.id}",
        created_id=draft.id,
    )


async def _create_checklist(
    session: AsyncSession, *, user: CurrentUser, context: dict[str, Any]
) -> ActionResponseOut:
    """Creates the application workspace for a saved opportunity."""
    opportunity_id = context.get("opportunityId")
    if not opportunity_id:
        raise validation(
            "Tell me which opportunity, and I will build the checklist.",
            {"opportunityId": ["An opportunity is required."]},
        )

    result = await session.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
    opportunity = result.scalar_one_or_none()
    if opportunity is None:
        raise not_found("That opportunity")

    existing = (
        await session.execute(
            select(Application).where(
                Application.owner_id == user.id,
                Application.opportunity_id == opportunity_id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return ActionResponseOut(
            block={"kind": "text", "text": "That opportunity is already in your workspace."},
            route=f"/applications/{existing.id}",
            created_id=existing.id,
        )

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

    return ActionResponseOut(
        block={
            "kind": "checklist",
            "title": f"What {opportunity.title} requires",
            "items": [
                {
                    "label": item["label"],
                    "status": item["status"],
                    "detail": item["note"],
                    "route": None,
                }
                for item in application.checklist
            ],
        },
        route=f"/applications/{application.id}",
        created_id=application.id,
    )


async def _start_run(
    session: AsyncSession, *, user: CurrentUser, context: dict[str, Any]
) -> ActionResponseOut:
    """Queues a research run.

    The run is durable: the browser may close and the run continues, and it
    is resumed rather than repeated.
    """
    from ..db.models import Run, RunEvent

    mission_id = context.get("missionId")
    if not mission_id:
        raise validation(
            "Tell me what to research first.",
            {"missionId": ["A mission is required."]},
        )

    result = await session.execute(
        select(Mission).where(Mission.id == mission_id, Mission.owner_id == user.id)
    )
    mission = result.scalar_one_or_none()
    if mission is None:
        raise not_found("That mission")

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

    return ActionResponseOut(
        block={
            "kind": "run",
            "runId": run.id,
            "status": "queued",
            "message": "Research started. I will report what I found and what I could not reach.",
        },
        route="/goals",
        created_id=run.id,
    )


# --------------------------------------------------------------------- #
# The lookups                                                          #
# --------------------------------------------------------------------- #


async def _profile(session: AsyncSession, user: CurrentUser) -> dict[str, Any] | None:
    """The caller's profile, with its facts."""
    result = await session.execute(select(Profile).where(Profile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile is None:
        return None

    facts = list(
        (await session.execute(select(ProfileFact).where(ProfileFact.profile_id == profile.id)))
        .scalars()
        .all()
    )

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
                "source": None,
            }
            for fact in facts
        ],
        "consent": dict(profile.consent or {}),
    }


async def _protected(session: AsyncSession, user: CurrentUser) -> dict[str, Any] | None:
    """The caller's protected section."""
    result = await session.execute(
        select(ProtectedProfile).where(ProtectedProfile.owner_id == user.id)
    )
    protected = result.scalar_one_or_none()
    if protected is None:
        return None

    return {
        "dateOfBirth": {
            "value": protected.date_of_birth,
            "status": protected.date_of_birth_status,
            "source": protected.date_of_birth_source,
            "updatedAt": protected.date_of_birth_updated_at.isoformat()
            if protected.date_of_birth_updated_at
            else None,
            "excludedFromAiContext": protected.excluded_from_ai_context,
        }
    }


async def _mission(session: AsyncSession, user: CurrentUser, mission_id: Any) -> Mission | None:
    """A mission, if it is the caller's."""
    if not mission_id:
        return None
    result = await session.execute(
        select(Mission).where(Mission.id == mission_id, Mission.owner_id == user.id)
    )
    return result.scalar_one_or_none()


async def _opportunity(session: AsyncSession, opportunity_id: Any) -> Opportunity | None:
    """An opportunity."""
    if not opportunity_id:
        return None
    result = await session.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
    return result.scalar_one_or_none()


async def _application(
    session: AsyncSession, user: CurrentUser, application_id: Any
) -> Application | None:
    """An application, if it is the caller's."""
    if not application_id:
        return None
    result = await session.execute(
        select(Application).where(Application.id == application_id, Application.owner_id == user.id)
    )
    return result.scalar_one_or_none()


async def _thread(session: AsyncSession, user: CurrentUser, mission: Mission | None) -> Any:
    """The conversation thread, created on first use."""
    from ..db.models import Thread

    result = await session.execute(
        select(Thread)
        .where(Thread.owner_id == user.id, Thread.mission_id == (mission.id if mission else None))
        .order_by(Thread.created_at.desc())
    )
    thread = result.scalars().first()
    if thread is not None:
        return thread

    return await create_thread(
        session, owner_id=user.id, mission_id=mission.id if mission else None
    )
