"""The shapes the service passes through.

The research data — an opportunity, its evidence, its sources, a match —
is produced by the agent and stored as it was produced. The service does
not re-shape it: the agent's output contract owns that shape, and the
frontend validates it on the way in.

The data the service *owns* — a profile, a mission, a draft, an alert — is
modelled explicitly, so a mistake in it is caught here rather than in the
browser.
"""

from __future__ import annotations

from typing import Any

from pydantic import ConfigDict, Field

from ..wire import WireModel


class ResearchRecord(WireModel):
    """A record the agent produced, kept as it was produced.

    The fields are open on purpose: the agent's schema is the contract for
    this data, and re-typing it here would create a second, drifting
    definition of the same thing.
    """

    model_config = ConfigDict(
        extra="allow",
        populate_by_name=True,
        protected_namespaces=(),
    )


class OpportunityListOut(WireModel):
    """A page of opportunities, with the caller's assessments."""

    opportunities: list[ResearchRecord] = Field(default_factory=list)
    matches: list[ResearchRecord] = Field(default_factory=list)
    next_cursor: str | None = None
    has_more: bool = False


class OpportunityDetailOut(WireModel):
    """One opportunity, in full."""

    opportunity: ResearchRecord
    match: ResearchRecord | None = None
    evidence: list[ResearchRecord] = Field(default_factory=list)
    sources: list[ResearchRecord] = Field(default_factory=list)
    application_id: str | None = None


class CompareRowOut(WireModel):
    """One opportunity in a comparison."""

    opportunity_id: str
    title: str
    institution: str
    country: str
    fit_score: int = 0
    eligibility: str = "unresolved"
    deadline: str | None = None
    deadline_verified: bool = False
    funding_coverage: str = "unknown"
    estimated_gap: float | None = None
    currency: str | None = None
    unresolved_requirements: list[str] = Field(default_factory=list)


class CompareOut(WireModel):
    """The comparison, and what it cannot settle."""

    rows: list[CompareRowOut] = Field(default_factory=list)
    differences: list[str] = Field(default_factory=list)
    unverified: list[str] = Field(default_factory=list)


class AnalyzeRequest(WireModel):
    """A link to analyse without a saved mission."""

    url: str


class RunStartOut(WireModel):
    """The `202 Accepted` body of a queued run."""

    run_id: str
    status: str = "queued"


class NextActionOut(WireModel):
    """The one action the student should take next."""

    id: str
    kind: str
    title: str
    rationale: str
    cta: str
    route: str
    priority: int = 0
    blocker_id: str | None = None
    created_at: str


class NextActionResponseOut(WireModel):
    action: NextActionOut | None = None


def row_dict(row: Any) -> dict[str, Any]:
    """The mapped columns of a row.

    A SQLAlchemy instance also carries its session state, which is not data
    and cannot be serialised. This returns only the columns.
    """
    return {column.key: getattr(row, column.key) for column in row.__mapper__.columns}


def as_dict(value: Any) -> dict[str, Any]:
    """A record, as a plain dictionary."""
    if isinstance(value, dict):
        return value
    return dict(value.__dict__)
