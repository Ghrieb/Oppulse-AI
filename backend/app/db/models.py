"""The tables.

The domain is the frontend's domain, and the ownership rule is the brief's:
every row a student can reach belongs to exactly one account. The
``owner_id`` on each table is not decoration — it is what the ownership
guard checks, so a bug in a query cannot leak another student's row.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .session import Base


def _now() -> datetime:
    return datetime.now(UTC)


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    """An account.

    The identity lives here, and nowhere else: the password hash, the
    address, and whether the backend has proved the student owns it.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    profile: Mapped[Profile | None] = relationship(back_populates="user", uselist=False)


class RefreshToken(Base):
    """A rotating refresh token.

    Only the hash is stored. The token is single-use: presenting one that
    was already spent revokes the whole family, because that is what a
    stolen-and-replayed token looks like.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    family_id: Mapped[str] = mapped_column(String(36), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Profile(Base):
    """A student's profile: the facts, the preferences and the consent."""

    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320))
    headline: Mapped[str | None] = mapped_column(String(200))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    preferences: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    consent: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    user: Mapped[User] = relationship(back_populates="profile")
    facts: Mapped[list[ProfileFact]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )


class ProfileFact(Base):
    """One fact.

    A fact is only eligible for a decision once it is *confirmed*. The
    status, the exclusion and the source are all here, because "where did
    this come from" is a question the student is entitled to an answer for.
    """

    __tablename__ = "profile_facts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    profile_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"), index=True)
    key: Mapped[str] = mapped_column(String(80), index=True)
    label: Mapped[str] = mapped_column(String(160))
    value: Mapped[str] = mapped_column(Text)
    numeric_value: Mapped[float | None] = mapped_column(Float)
    code: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="proposed")
    excluded: Mapped[bool] = mapped_column(Boolean, default=False)
    corrected: Mapped[bool] = mapped_column(Boolean, default=False)
    conflicting: Mapped[bool] = mapped_column(Boolean, default=False)
    source_document_id: Mapped[str | None] = mapped_column(String(36))
    source_document_name: Mapped[str | None] = mapped_column(String(200))
    source_excerpt: Mapped[str | None] = mapped_column(Text)
    source_page: Mapped[str | None] = mapped_column(String(80))
    source_section: Mapped[str | None] = mapped_column(String(120))
    confidence: Mapped[str] = mapped_column(String(16), default="medium")
    section: Mapped[str] = mapped_column(String(40))
    used_for: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )

    profile: Mapped[Profile] = relationship(back_populates="facts")


class ProfileFactRevision(Base):
    """The audit trail of a fact.

    Every confirmation, correction and exclusion is recorded. Consent
    revocation does not rewrite history: it stops future use.
    """

    __tablename__ = "profile_fact_revisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    fact_id: Mapped[str] = mapped_column(String(36), index=True)
    fact_label: Mapped[str] = mapped_column(String(160))
    action: Mapped[str] = mapped_column(String(24))
    previous_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    source_document_name: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ProtectedProfile(Base):
    """The protected part of a profile.

    The date of birth is here, and nowhere else. It is not a fact, so it is
    never sent to a model, and it is only ever used to check an age
    requirement.
    """

    __tablename__ = "protected_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    date_of_birth: Mapped[str | None] = mapped_column(String(10))
    date_of_birth_status: Mapped[str] = mapped_column(String(16), default="not_provided")
    date_of_birth_source: Mapped[str | None] = mapped_column(String(120))
    date_of_birth_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now
    )
    excluded_from_ai_context: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class Document(Base):
    """An uploaded document.

    The file itself is in private storage; the row holds the metadata, the
    processing state and the consent.
    """

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(120))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(24), default="other")
    status: Mapped[str] = mapped_column(String(24), default="awaiting_upload")
    consent_to_use: Mapped[bool] = mapped_column(Boolean, default=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    storage_key: Mapped[str | None] = mapped_column(String(500))
    content_hash: Mapped[str | None] = mapped_column(String(120))
    download_url: Mapped[str | None] = mapped_column(String(500))
    extraction: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class Mission(Base):
    """A mission: what the agent is looking for, and on whose behalf."""

    __tablename__ = "missions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(140))
    objective: Mapped[str] = mapped_column(Text)
    criteria: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="draft")
    source: Mapped[str] = mapped_column(String(16), default="manual")
    selected_document_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    confirmed_fact_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    limitations: Mapped[list[str]] = mapped_column(JSON, default=list)
    user_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    monitoring: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    latest_run_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class Run(Base):
    """One research run.

    A run is durable: it can be queued, resumed, paused and observed
    without the browser holding anything.
    """

    __tablename__ = "runs"
    __table_args__ = (
        UniqueConstraint("owner_id", "idempotency_key", name="uq_runs_owner_idempotency"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    mission_id: Mapped[str] = mapped_column(ForeignKey("missions.id"), index=True)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    status: Mapped[str] = mapped_column(String(24), default="queued")
    phase: Mapped[str] = mapped_column(String(24), default="queued")
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    budget: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    #: Which worker holds the lease, and until when. A run is claimed by
    #: exactly one worker, and a lease that ran out can be claimed again.
    claimed_by: Mapped[str | None] = mapped_column(String(64))
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: The stage the run is on, and what the completed stages produced, so
    #: a retry or a restart redoes only the stage that failed.
    checkpoint: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    #: How many times a worker has claimed this run.
    attempt: Mapped[int] = mapped_column(Integer, default=0)
    #: The client's key for a repeated creation: the same key, the same run.
    idempotency_key: Mapped[str | None] = mapped_column(String(120), index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class RunEvent(Base):
    """A factual event from a run.

    What happened, the object it happened to, and when. Never the model's
    internal reasoning.
    """

    __tablename__ = "run_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), index=True)
    type: Mapped[str] = mapped_column(String(48), index=True)
    message: Mapped[str] = mapped_column(Text)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class IdempotencyRecord(Base):
    """The first response for a repeated `Idempotency-Key`.

    The key names one action, the scope says which endpoint (and which
    row) it named, and the body is what the first successful call
    answered. A retry after a lost connection finds this record and gets
    the same answer instead of doing the work a second time.

    The record is written only after the mutation committed, so a failed
    attempt remembers nothing and the retry simply runs again.
    """

    __tablename__ = "idempotency_records"
    __table_args__ = (
        UniqueConstraint("owner_id", "scope", "key", name="uq_idempotency_owner_scope_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    #: The endpoint and the row it addressed, e.g. ``runs.retry:{id}``.
    scope: Mapped[str] = mapped_column(String(120))
    key: Mapped[str] = mapped_column(String(200))
    #: The stored response, as it went over the wire.
    response_body: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Thread(Base):
    """A conversation with the agent.

    The backend owns it. The frontend keeps a copy so a refresh is instant,
    but the server's copy is the one that decides what a turn may use.
    """

    __tablename__ = "threads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    mission_id: Mapped[str | None] = mapped_column(String(36), index=True)
    context: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class ThreadTurn(Base):
    """One turn of a conversation.

    The context that was used is recorded with the turn, so the harness can
    assert that an excluded document stayed excluded and that a corrected
    fact replaced the old value.
    """

    __tablename__ = "thread_turns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    thread_id: Mapped[str] = mapped_column(ForeignKey("threads.id"), index=True)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    mission_id: Mapped[str | None] = mapped_column(String(36))
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text, default="")
    blocks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    context: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    selected_fact_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    selected_document_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    consent_state: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    proposal_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    action_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    run_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class Application(Base):
    """A saved opportunity, turned into a workspace."""

    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    opportunity_id: Mapped[str] = mapped_column(String(36), index=True)
    opportunity_title: Mapped[str] = mapped_column(String(200))
    institution: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(24), default="considering")
    deadline: Mapped[str | None] = mapped_column(String(40))
    deadline_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    checklist: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    tasks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    draft_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    completion: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    next_best_action: Mapped[str | None] = mapped_column(Text)
    official_url: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class Draft(Base):
    """A document the agent prepared, and every version of it."""

    __tablename__ = "drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    application_id: Mapped[str] = mapped_column(String(36), index=True)
    opportunity_id: Mapped[str] = mapped_column(String(36), index=True)
    type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    current_version: Mapped[int] = mapped_column(Integer, default=1)
    content: Mapped[str] = mapped_column(Text, default="")
    versions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    pending_proposal: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class Opportunity(Base):
    """A researched opportunity.

    The requirements, the evidence and the deadline are the agent's
    conclusions, and they carry the source they came from. Every row is owned
    by the student who found it, so the opportunities page only shows a
    student's own.
    """

    __tablename__ = "opportunities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(240))
    institution: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(32), default="other")
    country: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    source_domain: Mapped[str] = mapped_column(String(200))
    canonical_url: Mapped[str] = mapped_column(String(500))
    summary: Mapped[str] = mapped_column(Text, default="")
    institution_brand: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    duration: Mapped[str | None] = mapped_column(String(80))
    application_opens_at: Mapped[str | None] = mapped_column(String(40))
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    deadline: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    additional_deadlines: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    funding: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    requirements: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    highlights: Mapped[list[str]] = mapped_column(JSON, default=list)
    field_status: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    saved: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Source(Base):
    """A retrieved source.

    A source that could not be reached is recorded as a failure, never as
    an absence: "we found nothing" and "we could not look" are different
    answers.
    """

    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    run_id: Mapped[str | None] = mapped_column(String(36), index=True)
    url: Mapped[str] = mapped_column(String(500))
    title: Mapped[str] = mapped_column(String(240))
    domain: Mapped[str] = mapped_column(String(200))
    excerpt: Mapped[str] = mapped_column(Text, default="")
    quality: Mapped[str] = mapped_column(String(16), default="unknown")
    status: Mapped[str] = mapped_column(String(16), default="retrieved")
    content_hash: Mapped[str | None] = mapped_column(String(120))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    page_reference: Mapped[str | None] = mapped_column(String(80))
    failure_reason: Mapped[str | None] = mapped_column(Text)


class Evidence(Base):
    """A claim, and the passage it came from."""

    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    source_id: Mapped[str] = mapped_column(String(36), index=True)
    opportunity_id: Mapped[str | None] = mapped_column(String(36), index=True)
    claim: Mapped[str] = mapped_column(Text)
    excerpt: Mapped[str] = mapped_column(Text, default="")
    page_reference: Mapped[str | None] = mapped_column(String(80))
    url: Mapped[str] = mapped_column(String(500))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    quality: Mapped[str] = mapped_column(String(16), default="unknown")
    stance: Mapped[str] = mapped_column(String(16), default="supports")
    confidence: Mapped[str] = mapped_column(String(16), default="medium")


class Match(Base):
    """The assessment of one opportunity against one profile."""

    __tablename__ = "matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    opportunity_id: Mapped[str] = mapped_column(String(36), index=True)
    profile_id: Mapped[str] = mapped_column(String(36), index=True)
    mission_id: Mapped[str | None] = mapped_column(String(36))
    fit_score: Mapped[int] = mapped_column(Integer, default=0)
    fit_label: Mapped[str] = mapped_column(String(80), default="")
    eligibility: Mapped[str] = mapped_column(String(16), default="unresolved")
    competitiveness: Mapped[str] = mapped_column(String(16), default="unknown")
    confidence: Mapped[str] = mapped_column(String(16), default="medium")
    reasons: Mapped[list[str]] = mapped_column(JSON, default=list)
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list)
    recommendation: Mapped[str] = mapped_column(Text, default="")
    profile_snapshot_id: Mapped[str | None] = mapped_column(String(36))
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Alert(Base):
    """An alert in the app.

    Only the in-app channel is active. The delivery records for the future
    channels live in the contract but not in the database, because a channel
    that cannot deliver has nothing to record.
    """

    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    monitor_event_id: Mapped[str | None] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(16), default="info")
    category: Mapped[str] = mapped_column(String(32), default="source_change")
    sensitivity: Mapped[str] = mapped_column(String(16), default="routine")
    delivery: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class MonitorTarget(Base):
    """A source the agent is watching."""

    __tablename__ = "monitor_targets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    target_type: Mapped[str] = mapped_column(String(24))
    target_id: Mapped[str | None] = mapped_column(String(36))
    label: Mapped[str] = mapped_column(String(140))
    url: Mapped[str | None] = mapped_column(String(500))
    frequency: Mapped[str] = mapped_column(String(16), default="daily")
    status: Mapped[str] = mapped_column(String(16), default="active")
    last_successful_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_scheduled_check_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    events_detected: Mapped[int] = mapped_column(Integer, default=0)
    source_unreachable: Mapped[bool] = mapped_column(Boolean, default=False)


class MonitorEvent(Base):
    """A change the agent noticed in a watched source."""

    __tablename__ = "monitor_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), index=True)
    monitor_target_id: Mapped[str] = mapped_column(String(36), index=True)
    type: Mapped[str] = mapped_column(String(32))
    what_changed: Mapped[str] = mapped_column(Text)
    why_it_matters: Mapped[str] = mapped_column(Text)
    recommended_action: Mapped[str] = mapped_column(Text)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    source_url: Mapped[str] = mapped_column(String(500))
    previous_hash: Mapped[str | None] = mapped_column(String(120))
    content_hash: Mapped[str] = mapped_column(String(120))
    is_test_event: Mapped[bool] = mapped_column(Boolean, default=False)


class OnboardingDraftRow(Base):
    """The onboarding draft, server-owned.

    It is one row per student, holding the answers as they are given, so a
    refresh — or another device — resumes exactly where the student left
    off.
    """

    __tablename__ = "onboarding_drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    draft: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now
    )


class PasswordResetToken(Base):
    """A password reset token.

    Only the hash is stored, and a token is single-use: it is spent the
    moment it changes a password.
    """

    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class EmailVerificationToken(Base):
    """A hashed, expiring, single-use email verification token."""

    __tablename__ = "email_verification_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AuditLog(Base):
    """The audit trail.

    Every sign-in, consent change, fact confirmation, proposal acceptance
    and external-action approval is recorded. The record says *what*
    happened, never the content.
    """

    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    owner_id: Mapped[str | None] = mapped_column(String(36), index=True)
    actor: Mapped[str] = mapped_column(String(80))
    event: Mapped[str] = mapped_column(String(64), index=True)
    object_type: Mapped[str | None] = mapped_column(String(40))
    object_id: Mapped[str | None] = mapped_column(String(36))
    detail: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    request_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


Index("ix_profile_facts_profile_key", ProfileFact.profile_id, ProfileFact.key)
Index("ix_opportunities_saved", Opportunity.saved)
UniqueConstraint("users.email", name="uq_users_email")
