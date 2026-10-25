"""What only deterministic code may produce.

The decision types live here, apart from the proposal types in
``app.ai.types``, and no AI stage may import this module. That separation
is the whole point: the model may propose, and only these services decide.

The boundary is enforced by a test that reads the stages' source and
fails if one of them imports this module or returns one of these types.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

#: How a requirement was decided.
RequirementStatus = Literal["likely", "unresolved", "ineligible", "not_applicable"]

#: How an application fares overall.
Eligibility = Literal["likely", "unresolved", "ineligible"]


class RequirementDecision(BaseModel):
    """The verdict on one requirement."""

    id: str
    status: RequirementStatus
    explanation: str
    #: The age that produced the verdict, when the requirement was an age
    #: one. Never the date of birth.
    age: int | None = None


class MatchDecision(BaseModel):
    """The assessment of one opportunity against one profile."""

    opportunity_id: str
    fit_score: int = 0
    eligibility: Eligibility = "unresolved"
    warnings: list[str] = Field(default_factory=list)
    confidence: Literal["low", "medium", "high"] = "medium"
    reasons: list[str] = Field(default_factory=list)


class NextActionDecision(BaseModel):
    """The one action the student should take next."""

    id: str
    kind: Literal[
        "confirm_fact",
        "resolve_conflict",
        "check_source",
        "complete_document",
        "review_proposal",
        "finish_draft",
    ]
    title: str
    rationale: str
    cta: str
    route: str
    priority: int
    blocker_id: str | None = None
    created_at: str


class AgeDecision(BaseModel):
    """The outcome of an age check."""

    status: Literal["satisfied", "not_satisfied", "unresolved", "conflicting"]
    age: int | None = None
    summary: str


class DecisionRecord(BaseModel):
    """Everything a run concluded, in one place.

    The harness re-derives this from the recorded proposals and compares
    it with the shipped one. That is the behavioural proof of the
    boundary: the decisions follow from the proposals and the deterministic
    services, and from nothing else.
    """

    requirements: list[RequirementDecision] = Field(default_factory=list)
    matches: list[MatchDecision] = Field(default_factory=list)
    next_action: NextActionDecision | None = None
    age: list[AgeDecision] = Field(default_factory=list)
