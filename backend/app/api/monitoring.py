"""Monitoring.

The sources the agent watches, the changes it noticed, and the alerts in
the student's app.

Monitoring is **scheduled, not real-time**, and the interface says so: the
last successful check and the next scheduled check are both shown, and a
source that could not be reached is a visible failure rather than a silent
gap.

Only the in-app channel is active. A delivery failure is never a lost
alert.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Alert, MonitorEvent, MonitorTarget, Opportunity
from ..db.session import get_session
from ..errors import conflict, not_found
from ..security.session import CurrentUser, current_user
from ..wire import WireModel

router = APIRouter(tags=["monitoring"])


class MonitorTargetOut(WireModel):
    id: str
    target_type: str
    target_id: str | None = None
    label: str
    url: str | None = None
    frequency: str
    status: str
    last_successful_check_at: str | None = None
    next_scheduled_check_at: str | None = None
    events_detected: int = 0
    source_unreachable: bool = False


class MonitorTargetListOut(WireModel):
    targets: list[MonitorTargetOut] = Field(default_factory=list)


class CreateMonitorTargetRequest(WireModel):
    target_type: str
    target_id: str | None = None
    url: str | None = None
    label: str = Field(min_length=1, max_length=140)
    frequency: str = "daily"


class UpdateMonitorTargetRequest(WireModel):
    status: str | None = None
    frequency: str | None = None


class MonitorEventOut(WireModel):
    id: str
    monitor_target_id: str
    type: str
    what_changed: str
    why_it_matters: str
    recommended_action: str
    detected_at: str
    source_url: str
    previous_hash: str | None = None
    content_hash: str
    is_test_event: bool = False


class MonitorEventListOut(WireModel):
    events: list[MonitorEventOut] = Field(default_factory=list)


class ChannelDeliveryOut(WireModel):
    channel: str
    status: str
    error: str | None = None
    attempted_at: str | None = None
    delivered_at: str | None = None
    idempotency_key: str | None = None


class AlertOut(WireModel):
    id: str
    monitor_event_id: str | None = None
    title: str
    body: str
    severity: str
    category: str
    sensitivity: str
    delivery: dict[str, Any] = Field(default_factory=dict)
    read: bool = False
    created_at: str


class AlertListOut(WireModel):
    alerts: list[AlertOut] = Field(default_factory=list)
    unread_count: int = 0


def _iso(value: datetime | None) -> str:
    if value is None:
        return datetime.now(UTC).isoformat()
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC).isoformat()
    return value.isoformat()


def _target_out(target: MonitorTarget) -> MonitorTargetOut:
    return MonitorTargetOut(
        id=target.id,
        target_type=target.target_type,
        target_id=target.target_id,
        label=target.label,
        url=target.url,
        frequency=target.frequency,
        status=target.status,
        last_successful_check_at=(
            _iso(target.last_successful_check_at) if target.last_successful_check_at else None
        ),
        next_scheduled_check_at=(
            _iso(target.next_scheduled_check_at) if target.next_scheduled_check_at else None
        ),
        events_detected=target.events_detected,
        source_unreachable=target.source_unreachable,
    )


def _alert_out(alert: Alert) -> AlertOut:
    return AlertOut(
        id=alert.id,
        monitor_event_id=alert.monitor_event_id,
        title=alert.title,
        body=alert.body,
        severity=alert.severity,
        category=alert.category,
        sensitivity=alert.sensitivity,
        delivery=dict(alert.delivery or {}),
        read=alert.read,
        created_at=_iso(alert.created_at),
    )


async def _owned_target(session: AsyncSession, user: CurrentUser, target_id: str) -> MonitorTarget:
    result = await session.execute(
        select(MonitorTarget).where(
            MonitorTarget.id == target_id, MonitorTarget.owner_id == user.id
        )
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise not_found("That monitored source")
    return target


@router.get("/monitor-targets", response_model=MonitorTargetListOut)
async def list_monitor_targets(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MonitorTargetListOut:
    """The sources the student is watching."""
    result = await session.execute(
        select(MonitorTarget).where(MonitorTarget.owner_id == user.id).order_by(MonitorTarget.label)
    )

    return MonitorTargetListOut(targets=[_target_out(target) for target in result.scalars().all()])


@router.post("/monitor-targets", response_model=MonitorTargetOut, status_code=201)
async def create_monitor_target(
    body: CreateMonitorTargetRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MonitorTargetOut:
    """Starts watching a source."""
    if body.target_type == "opportunity" and body.target_id:
        result = await session.execute(select(Opportunity).where(Opportunity.id == body.target_id))
        if result.scalar_one_or_none() is None:
            raise not_found("That opportunity")

    target = MonitorTarget(
        owner_id=user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        label=body.label,
        url=body.url,
        frequency=body.frequency,
        status="active",
        events_detected=0,
    )
    session.add(target)
    await session.commit()

    return _target_out(target)


@router.patch("/monitor-targets/{id}", response_model=MonitorTargetOut)
async def update_monitor_target(
    id: str,
    body: UpdateMonitorTargetRequest,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MonitorTargetOut:
    """Pauses, resumes or re-times a watched source."""
    target = await _owned_target(session, user, id)

    if body.status is not None:
        target.status = body.status
    if body.frequency is not None:
        target.frequency = body.frequency

    await session.commit()

    return _target_out(target)


@router.get("/monitor-events", response_model=MonitorEventListOut)
async def list_monitor_events(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> MonitorEventListOut:
    """The changes the agent noticed."""
    result = await session.execute(
        select(MonitorEvent)
        .where(MonitorEvent.owner_id == user.id)
        .order_by(MonitorEvent.detected_at.desc())
    )

    return MonitorEventListOut(
        events=[
            MonitorEventOut(
                id=event.id,
                monitor_target_id=event.monitor_target_id,
                type=event.type,
                what_changed=event.what_changed,
                why_it_matters=event.why_it_matters,
                recommended_action=event.recommended_action,
                detected_at=_iso(event.detected_at),
                source_url=event.source_url,
                previous_hash=event.previous_hash,
                content_hash=event.content_hash,
                is_test_event=event.is_test_event,
            )
            for event in result.scalars().all()
        ]
    )


@router.get("/alerts", response_model=AlertListOut)
async def list_alerts(
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> AlertListOut:
    """The alerts in the student's app."""
    result = await session.execute(
        select(Alert).where(Alert.owner_id == user.id).order_by(Alert.created_at.desc())
    )
    alerts = list(result.scalars().all())

    return AlertListOut(
        alerts=[_alert_out(alert) for alert in alerts],
        unread_count=sum(1 for alert in alerts if not alert.read),
    )


@router.post("/alerts/{id}/read", response_model=AlertOut)
async def read_alert(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> AlertOut:
    """Marks an alert as read."""
    result = await session.execute(select(Alert).where(Alert.id == id, Alert.owner_id == user.id))
    alert = result.scalar_one_or_none()
    if alert is None:
        raise not_found("That alert")

    alert.read = True
    await session.commit()

    return _alert_out(alert)


@router.post("/alerts/{id}/retry", response_model=AlertOut)
async def retry_alert(
    id: str,
    user: CurrentUser = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> AlertOut:
    """Retries a delivery.

    Only the in-app channel is active, and an in-app alert cannot fail its
    own delivery, so there is nothing to retry. The endpoint says so rather
    than pretending to have sent something.
    """
    result = await session.execute(select(Alert).where(Alert.id == id, Alert.owner_id == user.id))
    alert = result.scalar_one_or_none()
    if alert is None:
        raise not_found("That alert")

    raise conflict(
        "There is no other delivery channel yet. The alert is in the app, and it stays there."
    )
