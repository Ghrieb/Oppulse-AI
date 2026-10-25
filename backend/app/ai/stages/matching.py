"""Stage 5 — confirmed-profile matching.

Not an AI stage. The model has no say in whether a student is eligible:
the rule engine decides, using only the confirmed, non-excluded facts, and
the age service decides the age requirements.

This is the stage that makes an eligibility answer reproducible: the same
confirmed facts always produce the same verdict.
"""

from __future__ import annotations

from typing import Any, ClassVar

from ..decisions import MatchDecision, RequirementDecision
from ..rules.matching import evaluate_age_requirement, evaluate_requirement, recompute_match
from .base import Stage


class ConfirmedProfileMatchingStage(Stage):
    """Decides every requirement against the confirmed profile."""

    name: ClassVar[str] = "confirmed_profile_matching"

    async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        opportunities: list[dict[str, Any]] = list(payload.get("opportunities", []))
        matches: list[dict[str, Any]] = list(payload.get("matches", []))
        profile: dict[str, Any] | None = payload.get("profile")
        protected: dict[str, Any] | None = payload.get("protectedProfile")

        decisions: list[RequirementDecision] = []
        match_decisions: list[MatchDecision] = []
        age_decisions: list[dict[str, Any]] = []

        for opportunity in opportunities:
            for requirement in opportunity.get("requirements", []):
                decided = evaluate_requirement(requirement, profile, protected)
                decisions.append(
                    RequirementDecision(
                        id=str(decided.get("id", "")),
                        status=decided.get("status", "unresolved"),
                        explanation=str(decided.get("explanation", "")),
                    )
                )

                if decided.get("kind") == "age":
                    date_of_birth = None
                    if protected and not protected.get("dateOfBirth", {}).get(
                        "excludedFromAiContext", False
                    ):
                        raw = protected.get("dateOfBirth", {}).get("value")
                        date_of_birth = raw if isinstance(raw, str) else None
                    age_decisions.append(
                        {
                            "requirementId": decided.get("id"),
                            **evaluate_age_requirement(date_of_birth, decided.get("ageRule")),
                        }
                    )

            match = next(
                (item for item in matches if item.get("opportunityId") == opportunity.get("id")),
                None,
            )
            if match is None:
                continue

            recomputed_opportunity = {
                **opportunity,
                "requirements": [
                    evaluate_requirement(requirement, profile, protected)
                    for requirement in opportunity.get("requirements", [])
                ],
            }
            decided_match = recompute_match(match, recomputed_opportunity)
            match_decisions.append(
                MatchDecision(
                    opportunity_id=str(decided_match.get("opportunityId", "")),
                    fit_score=int(decided_match.get("fitScore", 0)),
                    eligibility=decided_match.get("eligibility", "unresolved"),
                    warnings=list(decided_match.get("warnings", [])),
                    confidence=decided_match.get("confidence", "medium"),
                    reasons=list(decided_match.get("reasons", [])),
                )
            )

        return {
            "requirements": decisions,
            "matches": match_decisions,
            "age": age_decisions,
        }
