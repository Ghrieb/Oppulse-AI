"""The missions and the runs.

A mission is what the agent is looking for, on the student's behalf. A run
is one attempt at it.

A run is **durable**: it is a row with a lease and a timeline of factual
events, so a browser refresh neither loses it nor creates a second one.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Mission, Run, RunEvent
from ..db.session import get_session
from ..errors import not_found
from ..security.session import CurrentUser, current_user
from ..wire import WireModel, iso_utc
from .idempotency import as_key, idempotency_key, remember, replay_if_seen
from .shapes import RunStartOut

router = APIRouter(tags=["missions"])

#: The statuses a run never leaves on its own.
TERMINAL_RUN_STATUSES = frozenset({"completed", "partial", "failed", "cancelled"})


class MonitoringConfigOut(WireModel):
    enabled: bool = False
    frequency: str = "weekly"


class MissionOut(WireModel):
    id: str
    title: str
    objective: str
    criteria: dict[str, Any] = Field(default_factory=dict)
    status: str
    source: str
    selected_document_ids: list[str] = Field(default_factory=list)
    confirmed_fact_ids: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    user_confirmed_at: str | None = None
    monitoring: MonitoringConfigOut = Field(default_factory=MonitoringConfigOut)
    latest_run_id: str | None = None
    created_at: str
    updated_at: str


class MissionListOut(WireModel):
    missions: list[MissionOut] = Field(default_factory=list)


class CreateMissionRequest(WireModel):
    title: str = Field(min_length=1, max_length=140)
    objective: str = Field(min_length=1, max_length=4000)
    criteria: dict[str, Any] | None = None
    source: str = "manual"


class UpdateMissionRequest(WireModel):
    title: str | None = Field(default=None, min_length=1, max_length=140)
    objective: str | None = Field(default=None, min_length=1, max_length=4000)
    criteria: dict[str, Any] | None = None
    status: str | None = None
    monitoring: dict[str, Any] | None = None


class RunSummaryOut(WireModel):
    sources_reviewed: int = 0
    candidates_found: int = 0
    needing_verification: int = 0
    unreachable: int = 0


class RunErrorOut(WireModel):
    code: str
    message: str
    retryable: bool = False


class RunBudgetOut(WireModel):
    model_calls: int = 0
    search_calls: int = 0
    fetched_sources: int = 0
    elapsed_seconds: int = 0


class RunOut(WireModel):
    id: str
    mission_id: str
    status: str
    phase: str
    summary: RunSummaryOut | None = None
    error: RunErrorOut | None = None
    budget_used: RunBudgetOut = Field(default_factory=RunBudgetOut)
    started_at: str | None = None
    finished_at: str | None = None


class RunEventOut(WireModel):
    id: str
    run_id: str
    type: str
    message: str
    data: dict[str, Any] | None = None
    created_at: str


class RunEventListOut(WireModel):
    events: list[RunEventOut] = Field(default_factory=list)
    next_cursor: str | None = None


def _iso(value: datetime | None) -> str:
    if value is None:
        return datetime.now(UTC).isoformat()
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC).isoformat()
    return value.isoformat()


def _mission_out(mission: Mission) -> MissionOut:
    monitoring = mission.monitoring or {}
    stored_criteria = dict(mission.criteria or {})
    # Older onboarding and assistant paths stored partial or snake_case
    # criteria. The browser contract expects a complete camelCase search
    # plan, so normalise it at the API boundary while those records remain.
    criteria = {
        "opportunityTypes": list(
            stored_criteria.get("opportunityTypes", stored_criteria.get("opportunity_types", []))
        ),
        "academicInterests": list(
            stored_criteria.get("academicInterests", stored_criteria.get("academic_interests", []))
        ),
        "destinations": list(stored_criteria.get("destinations", [])),
        "destinationCountries": list(
            stored_criteria.get("destinationCountries", stored_criteria.get("destination_countries", []))
        ),
        "educationLevel": stored_criteria.get(
            "educationLevel", stored_criteria.get("education_level", "any")
        ),
        "fundingPreference": stored_criteria.get(
            "fundingPreference", stored_criteria.get("funding_preference", "any")
        ),
        "startPeriod": str(stored_criteria.get("startPeriod", stored_criteria.get("start_period", ""))),
        "useProfile": bool(stored_criteria.get("useProfile", stored_criteria.get("use_profile", True))),
        "sourceScope": list(stored_criteria.get("sourceScope", stored_criteria.get("source_scope", []))),
    }
    return MissionOut(
        id=mission.id,
        title=mission.title,
        objective=mission.objective,
        criteria=criteria,
        status=mission.status,
        source=mission.source,
        selected_document_ids=list(mission.selected_document_ids or []),
        confirmed_fact_ids=list(mission.confirmed_fact_ids or []),
        limitations=list(mission.limitations or []),
        user_confirmed_at=(iso_utc(mission.user_confirmed_at)),
        monitoring=MonitoringConfigOut(
            enabled=bool(monitoring.get("enabled", False)),
            frequency=str(monitoring.get("frequency", "weekly")),
        ),
        latest_run_id=mission.latest_run_id,
        created_at=_iso(mission.created_at),
        updated_at=_iso(mission.updated_at),
    )


def _run_out(run: Run) -> RunOut:
    summary = run.summary or {}
    error = run.error or {}
    budget = run.budget or {}

    return RunOut(
        id=run.id,
        mission_id=run.mission_id,
        status=run.status,
        phase=run.phase,
        summary=RunSummaryOut(**summary) if summary else None,
        error=RunErrorOut(**error) if error else None,
        budget_used=RunBudgetOut(
            model_calls=int(budget.get("modelCalls", 0)),
            search_calls=int(budget.get("searchCalls", 0)),
            fetched_sources=int(budget.get("fetchedSources", 0)),
            elapsed_seconds=int(budget.get("elapsedSeconds", 0)),
        ),
        started_at=_iso(run.started_at) if run.started_at else None,
        finished_at=_iso(run.finished_at) if run.finished_at else None,
    )


async def _owned_mission(session: AsyncSession, user: CurrentUser, mission_id: str) -> Mission:
    result = await session.execute(
        select(Mission).where(Mission.id == mission_id, Mission.owner_id == user.id)
    )
    mission = result.scalar_one_or_none()
    if mission is None:
        raise not_found("That mission")
    return mission


async def _owned_run(session: AsyncSession, user: CurrentUser, run_id: str) -> Run:
    result = await session.execute(select(Run).where(Run.id == run_id, Run.owner_id == user.id))
    run = result.scalar_one_or_none()
    if run is None:
        raise not_found("That run")
    return run


@router.get("/missions", response_model=MissionListOut)
async def list_missions(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MissionListOut:
    """The caller's missions."""
    result = await session.execute(
        select(Mission).where(Mission.owner_id == user.id).order_by(Mission.updated_at.desc())
    )

    return MissionListOut(missions=[_mission_out(mission) for mission in result.scalars().all()])


@router.post("/missions", response_model=MissionOut, status_code=201)
async def create_mission(
    body: CreateMissionRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MissionOut:
    """Creates a mission."""
    mission = Mission(
        owner_id=user.id,
        title=body.title,
        objective=body.objective,
        criteria=dict(body.criteria or {}),
        status="draft",
        source=body.source,
        selected_document_ids=[],
        confirmed_fact_ids=[],
        limitations=[],
        monitoring={"enabled": False, "frequency": "weekly"},
    )
    session.add(mission)
    await session.commit()

    return _mission_out(mission)


@router.get("/missions/{id}", response_model=MissionOut)
async def read_mission(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MissionOut:
    """One mission."""
    return _mission_out(await _owned_mission(session, user, id))


@router.patch("/missions/{id}", response_model=MissionOut)
async def update_mission(
    id: str,
    body: UpdateMissionRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MissionOut:
    """Changes a mission."""
    mission = await _owned_mission(session, user, id)

    if body.title is not None:
        mission.title = body.title
    if body.objective is not None:
        mission.objective = body.objective
    if body.criteria is not None:
        mission.criteria = dict(body.criteria)
    if body.status is not None:
        mission.status = body.status
    if body.monitoring is not None:
        mission.monitoring = dict(body.monitoring)

    mission.updated_at = datetime.now(UTC)
    await session.commit()

    return _mission_out(mission)


@router.post("/missions/{id}/runs", response_model=RunStartOut, status_code=202)
async def start_run(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    key: str | None = Depends(idempotency_key),
) -> RunStartOut:
    """Queues a run.

    A run is a row with a lease, so a refresh neither loses it nor starts a
    second one: an unfinished run for this mission is resumed instead. With
    an `Idempotency-Key`, the same key always names the same run — even
    after that run finished — because the key is stored on the run itself
    and the unique constraint makes the claim atomic.
    """
    mission = await _owned_mission(session, user, id)
    key = as_key(key)

    if key is not None:
        keyed = (
            (
                await session.execute(
                    select(Run).where(Run.owner_id == user.id, Run.idempotency_key == key)
                )
            )
            .scalars()
            .first()
        )
        if keyed is not None:
            return RunStartOut(run_id=keyed.id, status=keyed.status)

    existing = (
        (
            await session.execute(
                select(Run)
                .where(Run.mission_id == mission.id, Run.owner_id == user.id)
                .order_by(Run.created_at.desc())
            )
        )
        .scalars()
        .first()
    )

    if existing is not None and existing.status in {"queued", "running", "paused"}:
        # The run this key names may already exist without one — it was
        # created before the client started sending keys. Attach the key
        # so every later repeat finds *this* run, finished or not.
        if key is not None and existing.idempotency_key is None:
            existing.idempotency_key = key
            try:
                await session.flush()
            except IntegrityError:
                # A concurrent twin attached the key first; its run — this
                # same run, now carrying the key — is the answer.
                await session.rollback()
                keyed_now = (
                    (
                        await session.execute(
                            select(Run).where(Run.owner_id == user.id, Run.idempotency_key == key)
                        )
                    )
                    .scalars()
                    .first()
                )
                if keyed_now is None:
                    raise
                return RunStartOut(run_id=keyed_now.id, status=keyed_now.status)
            await session.commit()
        return RunStartOut(run_id=existing.id, status=existing.status)

    now = datetime.now(UTC)
    run = Run(
        mission_id=mission.id,
        owner_id=user.id,
        status="queued",
        phase="queued",
        budget={},
        started_at=now,
        idempotency_key=key,
    )
    session.add(run)
    try:
        await session.flush()
    except IntegrityError:
        # A concurrent twin with this key won the insert. Its run *is*
        # the run this key names.
        await session.rollback()
        twin = (
            (
                await session.execute(
                    select(Run).where(Run.owner_id == user.id, Run.idempotency_key == key)
                )
            )
            .scalars()
            .first()
        )
        if twin is None:
            raise
        return RunStartOut(run_id=twin.id, status=twin.status)

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
    mission.status = "active"
    mission.updated_at = now
    await session.commit()

    return RunStartOut(run_id=run.id, status=run.status)


@router.get("/runs/{id}", response_model=RunOut)
async def read_run(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> RunOut:
    """One run."""
    return _run_out(await _owned_run(session, user, id))


@router.get("/runs/{id}/events", response_model=RunEventListOut)
async def read_run_events(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> RunEventListOut:
    """The factual events of a run.

    What happened, the object it happened to, and when. Never the model's
    internal reasoning.
    """
    await _owned_run(session, user, id)

    result = await session.execute(
        select(RunEvent).where(RunEvent.run_id == id).order_by(RunEvent.created_at)
    )
    events = list(result.scalars().all())

    return RunEventListOut(
        events=[
            RunEventOut(
                id=event.id,
                run_id=event.run_id,
                type=event.type,
                message=event.message,
                data=event.data,
                created_at=_iso(event.created_at),
            )
            for event in events
        ],
        next_cursor=None,
    )


@router.post("/runs/{id}/cancel", response_model=RunOut)
async def cancel_run(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    key: str | None = Depends(idempotency_key),
) -> RunOut:
    """Cancels a run.

    The run stops at its next checkpoint, and it is not deleted: the student
    can see what it did before it stopped.
    """
    scope = f"runs.cancel:{id}"
    stored = await replay_if_seen(session, owner_id=user.id, scope=scope, key=key)
    if stored is not None:
        return RunOut.model_validate(stored)

    run = await _owned_run(session, user, id)

    if run.status in TERMINAL_RUN_STATUSES:
        out = _run_out(run)
    else:
        now = datetime.now(UTC)
        run.status = "cancelled"
        run.finished_at = now
        session.add(
            RunEvent(
                run_id=run.id,
                type="run.cancelled",
                message="The run was cancelled.",
                data=None,
                created_at=now,
            )
        )
        await session.commit()
        out = _run_out(run)

    await remember(
        session, owner_id=user.id, scope=scope, key=key, body=out.model_dump(by_alias=True)
    )
    return out


@router.post("/runs/{id}/pause", response_model=RunOut)
async def pause_run(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> RunOut:
    """Pauses a run.

    The worker stops at its next checkpoint and keeps everything it has
    already done; the run stays on the row, so resuming continues from the
    stage it paused on rather than starting again.
    """
    run = await _owned_run(session, user, id)

    if run.status in TERMINAL_RUN_STATUSES or run.status == "paused":
        return _run_out(run)

    session.add(
        RunEvent(
            run_id=run.id,
            type="run.paused",
            message="The run was paused. It continues from its next checkpoint.",
            data=None,
            created_at=datetime.now(UTC),
        )
    )
    run.status = "paused"
    await session.commit()

    return _run_out(run)


@router.post("/runs/{id}/resume", response_model=RunOut)
async def resume_run(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> RunOut:
    """Re-queues a paused run.

    Nothing is re-done: the worker picks the run up and enters at the
    stage the checkpoint names.
    """
    run = await _owned_run(session, user, id)

    if run.status != "paused":
        return _run_out(run)

    session.add(
        RunEvent(
            run_id=run.id,
            type="run.resumed",
            message="The run was re-queued to continue from where it paused.",
            data=None,
            created_at=datetime.now(UTC),
        )
    )
    run.status = "queued"
    await session.commit()

    return _run_out(run)


@router.post("/runs/{id}/retry", response_model=RunOut)
async def retry_run(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    key: str | None = Depends(idempotency_key),
) -> RunOut:
    """Re-queues a run that failed or stopped short.

    Only the stage that failed is redone: the checkpoint holds what the
    earlier stages produced, and their events are already on the timeline.
    """
    scope = f"runs.retry:{id}"
    stored = await replay_if_seen(session, owner_id=user.id, scope=scope, key=key)
    if stored is not None:
        return RunOut.model_validate(stored)

    run = await _owned_run(session, user, id)

    if run.status not in {"failed", "partial"}:
        out = _run_out(run)
    else:
        session.add(
            RunEvent(
                run_id=run.id,
                type="run.retried",
                message="The run was re-queued. It will redo the stage that failed.",
                data=None,
                created_at=datetime.now(UTC),
            )
        )
        run.status = "queued"
        run.error = None
        run.finished_at = None
        await session.commit()
        out = _run_out(run)

    await remember(
        session, owner_id=user.id, scope=scope, key=key, body=out.model_dump(by_alias=True)
    )
    return out
