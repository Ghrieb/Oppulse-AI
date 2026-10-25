"""The AI/deterministic boundary.

The table below is the machine-readable version of the rule: the model may
propose, and only deterministic services may decide. It is not a comment —
``tests/test_ai_boundary.py`` reads it, reads the stages' source, and
fails the build if an AI stage decides something or constructs a decision
type.
"""

from __future__ import annotations

from dataclasses import dataclass

from .stages.base import StageOwner


@dataclass(frozen=True)
class BoundaryRule:
    """One decision, and who owns it."""

    #: The stage, or the function, that makes the decision.
    decision: str
    #: Who may influence it.
    owner: StageOwner
    #: Why the boundary is where it is.
    why: str
    #: What enforces it.
    enforced_by: str


BOUNDARY: tuple[BoundaryRule, ...] = (
    BoundaryRule(
        decision="mission_interpretation",
        owner=StageOwner.AI,
        why=(
            "Reading what the student means is a language task. A criterion the student did "
            "not author, and that no confirmed fact supports, is dropped by the stage."
        ),
        enforced_by="stages/mission.py drops unauthorised criteria",
    ),
    BoundaryRule(
        decision="requirement_extraction",
        owner=StageOwner.AI,
        why=(
            "Reading a requirement out of a call is a reading task. The stage attaches the "
            "source and the passage, so a requirement is never a bare assertion."
        ),
        enforced_by="stages/requirements.py attaches the source and the passage",
    ),
    BoundaryRule(
        decision="source_retrieval",
        owner=StageOwner.DETERMINISTIC,
        why=(
            "What is reachable is not a matter of opinion. A page that cannot be opened is "
            "recorded as unavailable, never as an empty result."
        ),
        enforced_by="stages/retrieval.py has no model dependency",
    ),
    BoundaryRule(
        decision="evidence_grounded_explanation",
        owner=StageOwner.AI,
        why=(
            "The prose is the model's job. Which sentences survive is not: a claim without a "
            "source, or one that promises admission, is dropped."
        ),
        enforced_by="stages/explanation.py drops ungrounded and promissory claims",
    ),
    BoundaryRule(
        decision="confirmed_profile_matching",
        owner=StageOwner.DETERMINISTIC,
        why=(
            "Eligibility is a rule, not an opinion. Only confirmed, non-excluded facts can "
            "resolve a requirement, and the same facts always give the same verdict."
        ),
        enforced_by="stages/matching.py calls the rule engine, which has no model dependency",
    ),
    BoundaryRule(
        decision="age_calculation",
        owner=StageOwner.DETERMINISTIC,
        why=(
            "The model may read an age rule out of a call; the arithmetic is done by the "
            "typed age service, on the eligibility date the source states."
        ),
        enforced_by="rules/matching.py: age_on, evaluate_age_rule",
    ),
    BoundaryRule(
        decision="next_action_derivation",
        owner=StageOwner.DETERMINISTIC,
        why=(
            "The priority function selects the action. The model may suggest candidates; it "
            "does not choose."
        ),
        enforced_by="stages/next_action.py calls the priority function",
    ),
    BoundaryRule(
        decision="draft_proposal",
        owner=StageOwner.AI,
        why=(
            "Writing the document is the model's job. Grounding it is not: a claim the agent "
            "could not trace to a confirmed fact is marked, and the student reviews the diff."
        ),
        enforced_by="stages/draft.py marks the ungrounded claims",
    ),
    BoundaryRule(
        decision="institution",
        owner=StageOwner.AI,
        why=(
            "Describing an institution is a reading task. What the official pages leave "
            "unsaid is named as unverified, never estimated: no competitiveness, no "
            "acceptance rate, no funding odds the sources do not state."
        ),
        enforced_by="stages/institution.py returns only description and unverified",
    ),
    BoundaryRule(
        decision="sending_or_submission",
        owner=StageOwner.DETERMINISTIC,
        why=(
            "Nothing leaves the device without a separate, explicit approval. In this release "
            "no external action is possible at all."
        ),
        enforced_by="the capability state and the absence of any sending endpoint",
    ),
)


def owner_of(stage_name: str) -> StageOwner | None:
    """Who owns a decision, by name."""
    for rule in BOUNDARY:
        if rule.decision == stage_name:
            return rule.owner
    return None


def deterministic_decisions() -> tuple[str, ...]:
    """The decisions the model may not influence."""
    return tuple(rule.decision for rule in BOUNDARY if rule.owner is StageOwner.DETERMINISTIC)


def ai_decisions() -> tuple[str, ...]:
    """The decisions the model may propose."""
    return tuple(rule.decision for rule in BOUNDARY if rule.owner is StageOwner.AI)
