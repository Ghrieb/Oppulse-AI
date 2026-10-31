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

from ..ai.context import (
    ConversationState,
    assemble_turn_context,
    build_student_summary,
    get_conversation_state,
    save_conversation_state,
)
from ..ai.intent import IntentType, classify_intent
from ..ai.compose import compose_response, ResponseContext
from ..ai.providers.base import ModelProvider, ProviderError
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
    IntentType,
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
    Thread,
)
from ..db.session import get_session
from ..errors import not_found, provider_failure, validation
from ..security.session import CurrentUser, current_user
from ..wire import WireModel, iso_utc

router = APIRouter(prefix="/assistant", tags=["assistant"])

#: How many search candidates one opportunity turn opens. The search itself
#: is one request; opening a page is cheap, and a wider candidate set survives
#: a host that refuses the fetcher.
SEARCH_CANDIDATES = 5

#: How many reachable pages the model reads. Each page is one model call, and
#: the free tier meters tokens per minute: two pages fit one turn.
EXTRACTED_SOURCES = 1


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

    # Convert ORM objects to dicts within session context
    # Query facts separately to avoid lazy loading issues in test environment
    from ..db.models import ProfileFact

    facts_result = await session.execute(
        select(ProfileFact).where(ProfileFact.profile_id == profile.id)
    )
    facts = list(facts_result.scalars().all())

    profile_dict = {
        "facts": [
            {
                "id": f.id,
                "key": f.key,
                "value": f.value,
                "status": f.status,
                "excluded": f.excluded,
                "corrected": f.corrected,
                "conflicting": f.conflicting,
            }
            for f in facts
        ],
        "consent": profile.consent or {},
        "headline": profile.headline,
        "full_name": profile.full_name,
        "email": profile.email,
        "preferences": profile.preferences or {},
    }
    protected_dict = {
        "dateOfBirth": {
            "value": protected.date_of_birth,
            "status": protected.date_of_birth_status,
            "excludedFromAiContext": protected.excluded_from_ai_context,
        }
    }

    context = assemble_turn_context(
        profile=profile_dict,
        protected_profile=protected_dict,
        documents=[document.__dict__ for document in documents],
        mission=mission.__dict__ if mission is not None else None,
        opportunity=opportunity.__dict__ if opportunity is not None else None,
        request=request_context,
    )

    # Get or create thread, load conversation state
    thread = await _thread(session, user, mission)

    # Load conversation state
    conv_state = await get_conversation_state(session, thread.id, user.id)
    conv_state.student_summary = build_student_summary(profile)

    # Update state with profile preferences
    prefs = profile.preferences or {}
    if prefs:
        for key in [
            "academicInterests",
            "degreeLevel",
            "destinations",
            "fundingPreference",
            "funding",
        ]:
            if key in prefs:
                conv_state.preferences[key] = prefs[key]

    # Also sync profile preferences to conversation state
    for key, value in (profile.preferences or {}).items():
        conv_state.preferences[key] = value

    # Classify intent
    prior_turns = conv_state.get_prior_turns()
    classified = await classify_intent(
        provider=await _get_model_provider(),
        text=body.message,
        context={
            "student_summary": conv_state.student_summary,
            "prior_turns": prior_turns,
            "preferences": conv_state.preferences,
            "active_mission_id": conv_state.active_mission_id,
            "active_run_id": conv_state.active_run_id,
            "outstanding_clarification": conv_state.outstanding_clarification,
        },
    )

    # Update conversation state with classified intent
    conv_state.update_from_intent(classified.intent, classified.entities)
    conv_state.add_turn("user", body.message, classified.intent, {"classified": classified.intent})

    # Record user turn
    await record_turn(
        session,
        thread=thread,
        role="user",
        content=body.message,
        context=context,
    )

    # Build response context for composition
    response_ctx = ResponseContext(
        intent=classified.intent,
        student_summary=conv_state.student_summary,
        prior_turns=prior_turns,
        active_mission_id=conv_state.active_mission_id,
        active_run_id=conv_state.active_run_id,
        outstanding_clarification=conv_state.outstanding_clarification,
        preferences=conv_state.preferences,
        active_run_status=conv_state.active_run_status,
    )

    # Add selected opportunity to context if present
    if conv_state.selected_opportunity_id:
        opp_result = await session.execute(
            select(Opportunity).where(Opportunity.id == conv_state.selected_opportunity_id)
        )
        response_ctx.selected_opportunity = opp_result.scalar_one_or_none()

    # Route to appropriate handler based on intent
    try:
        blocks, suggestions, response_payload = await _handle_intent(
            session=session,
            user=user,
            body=body,
            context=context,
            mission=mission,
            opportunity=opportunity,
            application=application,
            classified=classified,
            conv_state=conv_state,
            thread=thread,
        )
    except ProviderError as error:
        message = (
            "The AI service reached its rate limit. Please try again shortly."
            if error.code == "RATE_LIMITED"
            else "The AI service could not answer right now. Please try again."
        )
        raise provider_failure(error.code, message) from error

    # Compose natural response
    response_text = compose_response(classified.intent, response_ctx, response_payload)

    # Add the natural response as a text block (unless we already have blocks from handler)
    if not any(b.get("kind") == "text" and b.get("text") for b in blocks):
        blocks.insert(0, {"kind": "text", "text": response_text})

    # Add suggestions if not provided by handler
    if not suggestions:
        suggestions = _default_suggestions(classified.intent)

    # Validate and serialize the contract before persisting it. Handlers
    # intentionally compose plain dictionaries; only the response boundary
    # turns them into typed assistant blocks.
    typed_blocks = [AssistantBlockAdapter.validate_python(block) for block in blocks]

    # Record assistant turn
    await record_turn(
        session,
        thread=thread,
        role="assistant",
        content=response_text,
        context=context,
        blocks=[block.model_dump(by_alias=True, mode="json") for block in typed_blocks],
    )

    # Save conversation state
    await save_conversation_state(session, thread.id, user.id, conv_state)
    await session.commit()

    return ResponseOut(
        blocks=typed_blocks,
        suggestions=suggestions,
        context=context.to_record(),
    )


async def _handle_intent(
    session: AsyncSession,
    user: CurrentUser,
    body: MessageRequest,
    context: Any,
    mission: Mission | None,
    opportunity: Opportunity | None,
    application: Application | None,
    classified: Any,  # ClassifiedIntent
    conv_state: ConversationState,
    thread: Thread,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Route to appropriate handler based on intent."""
    from ..ai.providers import (
        build_fetcher,
        build_runtime_model_provider,
        build_runtime_search_provider,
    )
    from ..ai.worker import run_corpus

    intent = classified.intent
    blocks: list[dict[str, Any]] = []
    suggestions: list[str] = []
    response_payload: dict[str, Any] = {}

    settings = get_settings()
    corpus = run_corpus()
    model = build_runtime_model_provider(settings, corpus)
    search = build_runtime_search_provider(settings, corpus)
    fetcher = build_fetcher(settings, corpus)

    # A question asked from an opportunity card is about that opportunity.
    # Keep its answer source-backed instead of replacing it with generic chat.
    if opportunity is not None and intent in {
        "GENERAL_QUESTION",
        "FUNDING_QUESTION",
        "OUT_OF_SCOPE",
    }:
        return await _handle_opportunity_analysis(
            session,
            user,
            body,
            context,
            model,
            search,
            fetcher,
            opportunity,
            classified,
            conv_state,
        )

    if application is not None and intent == "APPLICATION_HELP":
        return (
            [
                {
                    "kind": "action",
                    "label": f"Continue application for {application.opportunity_title}",
                    "description": "Return to this application's checklist, drafts and next step.",
                    "action": "open_route",
                    "payload": {"route": f"/applications/{application.id}"},
                    "effect": "prepares",
                }
            ],
            [],
            {"stage": "application_help"},
        )

    # Handle each intent type
    if intent == "GREETING":
        return [], [], {}

    elif intent == "CASUAL":
        return [], [], {}

    elif intent == "GENERAL_QUESTION":
        # Answer directly without search
        answer = await _answer_general_question(model, classified.entities.get("question", ""))
        return [{"kind": "text", "text": answer}], [], {}

    elif intent == "FUNDING_QUESTION":
        answer = await _answer_funding_question(model, classified.entities.get("question", ""))
        return [{"kind": "text", "text": answer}], [], {}

    elif intent == "ELIGIBILITY_QUESTION":
        return await _handle_eligibility_question(
            session, user, opportunity, model, classified, conv_state
        )

    elif intent == "APPLICATION_HELP":
        return await _handle_application_help(
            session, user, opportunity, model, classified, conv_state
        )

    elif intent == "CV_QUESTION":
        return await _handle_cv_question(session, user, model, classified, conv_state)

    elif intent == "CLARIFICATION":
        return await _handle_clarification(session, user, classified, conv_state)

    elif intent == "URL_ANALYSIS":
        return await _handle_url_analysis(
            session, user, body, context, model, search, fetcher, classified, conv_state, thread
        )

    elif intent == "DISCOVERY":
        return await _handle_discovery(
            session, user, body, context, model, search, fetcher, classified, conv_state, thread
        )

    elif intent == "PREFERENCE_CHANGE":
        return await _handle_preference_change(session, user, mission, classified, conv_state)

    elif intent == "FOLLOWUP":
        return await _handle_followup(session, user, mission, classified, conv_state)

    elif intent == "OUT_OF_SCOPE":
        return [], [], {}

    # Default fallback - run opportunity analysis if opportunity selected
    if opportunity is not None:
        return await _handle_opportunity_analysis(
            session,
            user,
            body,
            context,
            model,
            search,
            fetcher,
            opportunity,
            classified,
            conv_state,
        )

    # Ultimate fallback
    return [{"kind": "text", "text": "I'm not sure I understand. Could you rephrase that?"}], [], {}


async def _handle_opportunity_analysis(
    session: AsyncSession,
    user: CurrentUser,
    body: MessageRequest,
    context: Any,
    model: ModelProvider,
    search: Any,
    fetcher: Any,
    opportunity: Opportunity,
    classified: Any,
    conv_state: ConversationState,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Handle analysis when a specific opportunity is selected."""
    blocks: list[dict[str, Any]] = []
    suggestions: list[str] = []
    response_payload = {"stage": "analysis"}

    descriptor = opportunity.summary or opportunity.title or ""

    # The student's wording is the primary retrieval query. Profile and card
    # context is passed to later stages, but diluting this string prevents a
    # replayed or exact-match provider from finding the selected programme.
    query = body.message.strip() or descriptor

    include_domains: list[str] = []
    if opportunity.source_domain:
        include_domains.append(opportunity.source_domain)

    retrieved = await SourceRetrievalStage(search, fetcher).run(
        {
            "query": query,
            "limit": SEARCH_CANDIDATES,
            "includeDomains": include_domains,
        }
    )

    requirements = []
    extracted = 0
    for source in retrieved:
        if source.status != "retrieved":
            continue
        if extracted >= EXTRACTED_SOURCES:
            break
        requirements.extend(await RequirementExtractionStage(model).run({"source": source}))
        extracted += 1

    explanation = await EvidenceGroundedExplanationStage(model).run(
        {
            "requirements": requirements,
            "sources": [
                {"id": source.id, "title": source.title, "excerpt": source.excerpt}
                for source in retrieved
            ],
        }
    )

    opened = [source for source in retrieved if source.status == "retrieved"]
    summary = explanation.summary.strip()
    if not summary:
        summary = (
            "I read the sources below; the requirements they state are listed under them."
            if requirements
            else (
                "I opened the sources below, but none of them stated the eligibility "
                "requirements. Check the original pages for the current rules."
            )
        )

    blocks.append(
        {
            "kind": "evidence",
            "title": (opportunity.title or "")[:120] or "What the source says",
            "summary": summary,
            "sources": [
                {
                    "title": source.title,
                    "url": source.url,
                    "quote": source.excerpt[:400],
                    "quality": source.quality,
                }
                for source in opened
            ],
            "requirementId": None,
        }
    )

    if requirements:
        blocks.append(
            {
                "kind": "checklist",
                "title": f"What {opportunity.title or 'this call'} requires",
                "items": [
                    {
                        "label": requirement.label,
                        "status": "ready"
                        if requirement.verification == "verified"
                        else "needs_attention",
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
    response_payload = {"stage": "analysis", "opportunity_id": opportunity.id}

    return blocks, suggestions, response_payload


async def _handle_discovery(
    session: AsyncSession,
    user: CurrentUser,
    body: MessageRequest,
    context: Any,
    model: ModelProvider,
    search: Any,
    fetcher: Any,
    classified: Any,
    conv_state: ConversationState,
    thread: Thread,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Handle opportunity discovery request - create mission and run."""
    blocks: list[dict[str, Any]] = []
    suggestions: list[str] = []
    response_payload = {"stage": "discovery_started"}

    # Create mission for discovery
    mission = Mission(
        owner_id=user.id,
        title="Opportunity Discovery",
        objective=body.message,
        criteria={
            "objective": body.message,
            "filters": {},
            "opportunity_types": classified.entities.get("opportunity_types", []),
            "funding_preference": classified.entities.get("funding_preference", "any"),
            "destinations": classified.entities.get("destinations", []),
            "destination_countries": classified.entities.get("destination_countries", []),
        },
        status="active",
        source="assistant",
    )
    session.add(mission)
    await session.flush()

    # Create run for the discovery mission
    import uuid

    run_id = str(uuid.uuid4())
    run = Run(
        id=run_id,
        mission_id=mission.id,
        owner_id=user.id,
        status="queued",
        phase="queued",
        budget={"max_tokens": 8000, "max_cost": 10.0, "time_limit": 300},
        checkpoint={"stage": "planning", "opportunityId": None},
        attempt=0,
        idempotency_key=None,
    )
    session.add(run)
    await session.commit()

    # Update conversation state
    conv_state.set_active_mission(mission.id, run_id)

    # Trigger assistant discovery via thread
    from ..db.models import ThreadTurn

    turn = ThreadTurn(
        thread_id=thread.id,
        owner_id=thread.owner_id,
        mission_id=thread.mission_id,
        role="user",
        content=body.message,
        blocks=[],
        context={"objective": body.message, "discovery_triggered": True},
        selected_fact_ids=[],
        selected_document_ids=[],
        consent_state={"allowProfileMatching": True, "externalModelProcessing": False},
        run_id=run_id,
    )
    session.add(turn)
    await session.commit()

    response_payload = {"stage": "started", "run_id": run_id, "mission_id": mission.id}
    return blocks, [], response_payload


async def _handle_url_analysis(
    session: AsyncSession,
    user: CurrentUser,
    body: MessageRequest,
    context: Any,
    model: ModelProvider,
    search: Any,
    fetcher: Any,
    classified: Any,
    conv_state: ConversationState,
    thread: Thread,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Handle URL analysis request."""
    blocks: list[dict[str, Any]] = []
    suggestions: list[str] = []
    response_payload = {"stage": "url_analysis_started"}

    # Extract URL from message
    import re

    url_match = re.search(r"https?://\S+", body.message)
    if not url_match:
        return (
            [
                {
                    "kind": "text",
                    "text": "I didn't find a URL in your message. Please paste a programme link.",
                }
            ],
            [],
            {},
        )

    url = url_match.group(0)

    # Create mission for URL analysis
    mission = Mission(
        owner_id=user.id,
        title="URL Analysis",
        objective=f"Analyze {url}",
        criteria={},
        status="active",
        source="assistant",
    )
    session.add(mission)
    await session.flush()

    # Create run
    import uuid

    run_id = str(uuid.uuid4())
    run = Run(
        id=run_id,
        mission_id=mission.id,
        owner_id=user.id,
        status="queued",
        phase="queued",
        budget={"max_tokens": 8000, "max_cost": 10.0, "time_limit": 300},
        checkpoint={"stage": "planning", "opportunityId": None},
        attempt=0,
        idempotency_key=None,
    )
    session.add(run)
    await session.commit()

    # Update conversation state
    conv_state.set_active_mission(mission.id, run_id)

    # Trigger via thread
    from ..db.models import ThreadTurn

    turn = ThreadTurn(
        thread_id=thread.id,
        owner_id=thread.owner_id,
        mission_id=thread.mission_id,
        role="user",
        content=body.message,
        blocks=[],
        context={"objective": f"Analyze {url}", "url": url, "discovery_triggered": True},
        selected_fact_ids=[],
        selected_document_ids=[],
        consent_state={"allowProfileMatching": True, "externalModelProcessing": False},
        run_id=run_id,
    )
    session.add(turn)
    await session.commit()

    response_payload = {"stage": "started", "run_id": run_id, "url": url}
    return blocks, [], response_payload


async def _handle_preference_change(
    session: AsyncSession,
    user: CurrentUser,
    mission: Mission | None,
    classified: Any,
    conv_state: ConversationState,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Handle preference update."""
    # Update mission criteria if exists
    if mission:
        criteria = dict(mission.criteria or {})
        if "field" in classified.entities:
            criteria["opportunity_types"] = classified.entities["field"]
        if "degree_level" in classified.entities:
            criteria["education_level"] = classified.entities["degree_level"]
        if "destinations" in classified.entities:
            criteria["destinations"] = classified.entities["destinations"]
        if "funding" in classified.entities:
            criteria["funding_preference"] = classified.entities["funding"]
        mission.criteria = criteria
        await session.commit()

    return (
        [{"kind": "text", "text": f"Updated! I'll adjust the search for: {classified.entities}"}],
        [],
        {},
    )


async def _handle_followup(
    session: AsyncSession,
    user: CurrentUser,
    mission: Mission | None,
    classified: Any,
    conv_state: ConversationState,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Handle short contextual follow-up."""
    # The response composer handles the natural response
    # Just need to update state
    return [], [], {"stage": "followup"}


async def _handle_clarification(
    session: AsyncSession,
    user: CurrentUser,
    classified: Any,
    conv_state: ConversationState,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Handle clarification request."""
    clarification = conv_state.outstanding_clarification or "I was asking for a bit more detail."
    return (
        [{"kind": "text", "text": f"Sorry, I may have made that confusing. {clarification}"}],
        [],
        {},
    )


async def _handle_eligibility_question(
    session: AsyncSession,
    user: CurrentUser,
    opportunity: Opportunity | None,
    model: ModelProvider,
    classified: Any,
    conv_state: ConversationState,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Handle eligibility question."""
    if opportunity:
        # Run eligibility analysis on the selected opportunity
        from ..ai.providers import build_fetcher, build_runtime_search_provider
        from ..ai.worker import run_corpus
        from ..config import get_settings

        settings = get_settings()
        corpus = run_corpus()
        search = build_runtime_search_provider(settings, corpus)
        fetcher = build_fetcher(settings, corpus)

        criteria = opportunity.__dict__
        interests = " ".join(criteria.get("academic_interests", []))
        destinations = " ".join(criteria.get("destinations", []))
        countries = " ".join(criteria.get("destination_countries", []))
        funding = criteria.get("funding_preference", "")
        descriptor = opportunity.summary or opportunity.title or ""

        query = " ".join(
            p
            for p in (
                descriptor,
                opportunity.type or "",
                interests,
                destinations,
                countries,
                funding,
                "eligibility requirements",
            )
            if p
        )
        include_domains = [opportunity.source_domain] if opportunity.source_domain else []

        retrieved = await SourceRetrievalStage(search, fetcher).run(
            {
                "query": query,
                "limit": SEARCH_CANDIDATES,
                "includeDomains": include_domains,
            }
        )

        requirements = []
        for source in retrieved:
            if source.status == "retrieved":
                requirements.extend(await RequirementExtractionStage(model).run({"source": source}))

        # Build eligibility summary
        if requirements:
            eligible = sum(1 for r in requirements if r.verification == "verified")
            total = len(requirements)
            text = (
                f"Based on the sources I found, {eligible} of {total} requirements are verified. "
            )
            text += "Here's the breakdown:" if total > 0 else ""
        else:
            text = "I couldn't find specific eligibility requirements in the sources I reached."

        return [{"kind": "text", "text": text}], [], {"stage": "eligibility"}

    return (
        [
            {
                "kind": "text",
                "text": "To check eligibility, I need a specific opportunity. Pick one from the list or paste a URL.",
            }
        ],
        [],
        {},
    )


async def _handle_application_help(
    session: AsyncSession,
    user: CurrentUser,
    opportunity: Opportunity | None,
    model: ModelProvider,
    classified: Any,
    conv_state: ConversationState,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Handle application assistance request."""
    if opportunity:
        return (
            [
                {
                    "kind": "action",
                    "label": f"Start application for {opportunity.title}",
                    "description": "Open the workspace for this application — the checklist, the drafts and the next step.",
                    "action": "open_route",
                    "payload": {"route": f"/applications/new?opportunity={opportunity.id}"},
                    "effect": "prepares",
                }
            ],
            [],
            {"stage": "application_help"},
        )

    return (
        [
            {
                "kind": "text",
                "text": "I can help with applications once you've picked an opportunity. Save one to your workspace and I'll guide you through the process.",
            }
        ],
        [],
        {},
    )


async def _handle_cv_question(
    session: AsyncSession,
    user: CurrentUser,
    model: ModelProvider,
    classified: Any,
    conv_state: ConversationState,
) -> tuple[list[dict[str, Any]], list[str], dict[str, Any]]:
    """Handle CV/profile questions."""
    return (
        [
            {
                "kind": "action",
                "label": "Upload CV",
                "description": "Upload your CV and I'll extract your academic background, research experience, and skills.",
                "action": "open_route",
                "payload": {"route": "/documents"},
                "effect": "prepares",
            }
        ],
        [],
        {},
    )


async def _answer_general_question(model: ModelProvider, question: str) -> str:
    """Answer a general knowledge question."""
    response = await model.chat(
        messages=[
            {
                "role": "system",
                "content": "You are an academic opportunity adviser. Answer the question concisely and naturally.",
            },
            {"role": "user", "content": question},
        ],
        temperature=0.3,
        max_tokens=300,
    )
    return response.content


async def _answer_funding_question(model: ModelProvider, question: str) -> str:
    """Answer a funding question."""
    response = await model.chat(
        messages=[
            {
                "role": "system",
                "content": "You are an academic opportunity adviser. Answer funding questions clearly and practically.",
            },
            {"role": "user", "content": question},
        ],
        temperature=0.3,
        max_tokens=300,
    )
    return response.content


def _default_suggestions(intent: IntentType) -> list[str]:
    """Default suggestions based on intent."""
    suggestions_map = {
        "GREETING": [
            "Find fully funded opportunities for me",
            "Analyse a link I paste in",
            "Upload my CV",
        ],
        "CASUAL": [
            "Find opportunities for me",
            "Check my eligibility",
            "Upload my CV",
        ],
        "DISCOVERY": [
            "Show me the results",
            "Refine the search",
            "Save an opportunity",
        ],
        "URL_ANALYSIS": [
            "Check the analysis progress",
            "What did you find?",
            "Analyse another link",
        ],
        "FOLLOWUP": [
            "Continue the search",
            "Change preferences",
            "Start over",
        ],
        "PREFERENCE_CHANGE": [
            "Search again",
            "Show current preferences",
            "Reset preferences",
        ],
        "ELIGIBILITY_QUESTION": [
            "Check another opportunity",
            "What does eligible mean?",
            "How to improve eligibility",
        ],
        "FUNDING_QUESTION": [
            "What does fully funded mean?",
            "Compare funding across opportunities",
            "Find fully funded opportunities",
        ],
        "APPLICATION_HELP": [
            "Start a draft",
            "Check requirements",
            "Track deadlines",
        ],
        "CV_QUESTION": [
            "Upload CV",
            "Review my profile",
            "Add a document",
        ],
        "CLARIFICATION": [
            "Try again",
            "Start over",
            "Change topic",
        ],
    }
    return suggestions_map.get(
        intent, ["Find opportunities for me", "Analyse a link", "Upload my CV"]
    )


# --------------------------------------------------------------------- #
# Helpers                                                              #
# --------------------------------------------------------------------- #


async def _get_model_provider() -> ModelProvider:
    from ..ai.providers import build_runtime_model_provider
    from ..ai.worker import run_corpus
    from ..config import get_settings

    settings = get_settings()
    return build_runtime_model_provider(settings, run_corpus())


async def _profile(session: AsyncSession, user: CurrentUser) -> Profile:
    result = await session.execute(select(Profile).where(Profile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = Profile(user_id=user.id, full_name=user.full_name or "", email=user.email)
        session.add(profile)
        await session.flush()
    return profile


async def _protected(session: AsyncSession, user: CurrentUser) -> ProtectedProfile:
    result = await session.execute(
        select(ProtectedProfile).where(ProtectedProfile.owner_id == user.id)
    )
    protected = result.scalar_one_or_none()
    if protected is None:
        protected = ProtectedProfile(
            owner_id=user.id,
            date_of_birth_status="not_provided",
            date_of_birth_updated_at=datetime.now(UTC),
        )
        session.add(protected)
        await session.flush()
    return protected


async def _mission(
    session: AsyncSession,
    user: CurrentUser,
    mission_id: str | None,
) -> Mission | None:
    if mission_id:
        result = await session.execute(
            select(Mission).where(Mission.id == mission_id, Mission.owner_id == user.id)
        )
        return result.scalar_one_or_none()
    # Return the most recent active mission
    result = await session.execute(
        select(Mission)
        .where(Mission.owner_id == user.id, Mission.status == "active")
        .order_by(Mission.updated_at.desc())
    )
    return result.scalars().first()


async def _opportunity(
    session: AsyncSession,
    opportunity_id: str | None,
) -> Opportunity | None:
    if not opportunity_id:
        return None
    result = await session.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
    return result.scalar_one_or_none()


async def _application(
    session: AsyncSession,
    user: CurrentUser,
    application_id: str | None,
) -> Application | None:
    if not application_id:
        return None
    result = await session.execute(
        select(Application).where(Application.id == application_id, Application.owner_id == user.id)
    )
    return result.scalar_one_or_none()


def _profile_to_dict(profile: Profile) -> dict[str, Any]:
    """Convert Profile ORM to dict for assemble_turn_context."""
    return {
        "facts": [
            {
                "id": f.id,
                "key": f.key,
                "value": f.value,
                "status": f.status,
                "excluded": f.excluded,
                "corrected": f.corrected,
                "conflicting": f.conflicting,
            }
            for f in (profile.facts or [])
        ],
        "consent": profile.consent or {},
        "headline": profile.headline,
        "full_name": profile.full_name,
        "email": profile.email,
        "preferences": profile.preferences or {},
    }


def _protected_to_dict(protected: ProtectedProfile) -> dict[str, Any]:
    """Convert ProtectedProfile ORM to dict for assemble_turn_context."""
    return {
        "dateOfBirth": {
            "value": protected.date_of_birth,
            "status": protected.date_of_birth_status,
            "excludedFromAiContext": protected.excluded_from_ai_context,
        }
    }


# Compatibility function for tests that patch _answer
async def _answer(*args, **kwargs):
    """Compatibility wrapper for tests that patch _answer."""
    raise NotImplementedError("_answer has been replaced by _handle_intent")


async def _thread(
    session: AsyncSession,
    user: CurrentUser,
    mission: Mission | None,
) -> Thread:
    """Get or create the assistant thread for this user and mission."""
    from ..ai.thread import create_thread as create_thread_fn

    # Find existing thread for this user and mission
    result = await session.execute(
        select(Thread).where(
            Thread.owner_id == user.id, Thread.mission_id == (mission.id if mission else None)
        )
    )
    thread = result.scalars().first()

    if thread is None:
        thread = await create_thread_fn(
            session, owner_id=user.id, mission_id=mission.id if mission else None
        )

    return thread


# --------------------------------------------------------------------- #
# The block builders (kept from original)                              #
# --------------------------------------------------------------------- #


def _media_from(sources: list[RetrievedSource]) -> list[MediaContext]:
    """The media on the official pages that were actually opened."""
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
    """A pointer to the call the answer rests on."""
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
    """What could not be verified: the disagreement or the gap, and the next step."""
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


@router.post("/actions", response_model=ActionResponseOut)
async def run_action(
    body: ActionRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ActionResponseOut:
    """Runs an action the assistant offered."""
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


async def _create_draft(
    session: AsyncSession,
    *,
    user: CurrentUser,
    payload: dict[str, Any],
    context: dict[str, Any],
) -> ActionResponseOut:
    """Starts a document."""
    from ..ai.providers import build_runtime_model_provider
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
    model = build_runtime_model_provider(settings, run_corpus())
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
            "kind": "text",
            "text": "Draft created. Open it to review and edit.",
        },
        route=f"/writing/{draft.id}",
        created_id=draft.id,
    )


async def _create_checklist(
    session: AsyncSession,
    *,
    user: CurrentUser,
    context: dict[str, Any],
) -> ActionResponseOut:
    """Creates a personal checklist from the opportunity's requirements."""
    opportunity_id = context.get("opportunityId")
    if not opportunity_id:
        raise validation("No opportunity selected.", {"opportunityId": ["Required."]})

    result = await session.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
    opportunity = result.scalar_one_or_none()
    if opportunity is None:
        raise not_found("That opportunity")

    # Get the match for this opportunity
    from ..db.models import Match

    result = await session.execute(
        select(Match).where(Match.opportunity_id == opportunity_id, Match.owner_id == user.id)
    )
    match = result.scalar_one_or_none()

    requirements = opportunity.requirements or []
    if match and match.reasons:
        # Use match assessment if available
        pass

    # For now, return a simple response
    return ActionResponseOut(
        block={"kind": "text", "text": "Checklist feature coming soon."},
        route=f"/opportunities/{opportunity_id}",
        created_id=None,
    )


async def _start_run(
    session: AsyncSession,
    *,
    user: CurrentUser,
    context: dict[str, Any],
) -> ActionResponseOut:
    """Starts a research run for a mission."""
    mission_id = context.get("missionId")
    if not mission_id:
        raise validation("No mission specified.", {"missionId": ["Required."]})

    from ..api.missions import start_run as start_run_fn

    result = await start_run_fn(mission_id, user, session)
    return ActionResponseOut(
        block={"kind": "text", "text": "Research started. Check back shortly for results."},
        route=f"/goals",
        created_id=result.id,
    )


# Need to import Run for the new handlers
from ..db.models import Run
