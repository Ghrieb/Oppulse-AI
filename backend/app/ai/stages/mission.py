"""Stage 1 — mission interpretation.

The model reads what the student wants and proposes a mission. What it may
*not* do is invent a criterion: a criterion the student did not give, and
that no confirmed profile fact supports, is dropped and named.
"""

from __future__ import annotations

from typing import Any, ClassVar

from ..providers.base import ModelProvider
from ..types import MissionCriteriaProposal, ModelRequest
from .base import ProposalStage


class MissionInterpretationStage(ProposalStage):
    """Turns a goal into a mission the student can review."""

    name: ClassVar[str] = "mission_interpretation"

    def __init__(self, model: ModelProvider) -> None:
        self._model = model

    async def run(self, payload: dict[str, Any]) -> MissionCriteriaProposal:
        goal = str(payload.get("goal", ""))
        allowed_scope = dict(payload.get("allowedScope", {}))
        confirmed_facts = list(payload.get("confirmedFacts", []))

        request = ModelRequest(
            stage=self.name,
            instruction=(
                "Propose a mission for this goal. Use only the destinations, fields and "
                "funding preference the student gave or that a confirmed fact supports."
            ),
            context={
                "goal": goal,
                "allowedScope": allowed_scope,
                "confirmedFacts": confirmed_facts,
            },
            response_schema="MissionCriteriaProposal",
        )

        response = await self._model.complete(request)
        proposed = MissionCriteriaProposal.model_validate(response.parsed)

        return _drop_unsupported_criteria(proposed, allowed_scope, confirmed_facts)


def _drop_unsupported_criteria(
    proposal: MissionCriteriaProposal,
    allowed_scope: dict[str, Any],
    confirmed_facts: list[dict[str, Any]],
) -> MissionCriteriaProposal:
    """Removes the criteria the student never authorised.

    A destination the student did not choose, and that no confirmed fact
    supports, is not a preference — it is the agent guessing. The criterion
    is dropped, and named in ``dropped`` so the omission is visible rather
    than silent.
    """
    allowed_destinations = {str(value).lower() for value in allowed_scope.get("destinations", [])}
    supported_interests = {
        str(fact.get("value", "")).lower() for fact in confirmed_facts if fact.get("key") == "field"
    }
    supported_countries = {
        str(value).upper() for value in allowed_scope.get("destinationCountries", [])
    }

    dropped: list[str] = []
    kept_interests: list[str] = []

    for interest in proposal.academic_interests:
        lowered = interest.strip().lower()
        if lowered in supported_interests or not allowed_scope:
            kept_interests.append(interest)
        else:
            dropped.append(f"academic interest: {interest}")

    kept_destinations: list[str] = []
    for destination in proposal.destinations:
        if not allowed_destinations or destination.strip().lower() in allowed_destinations:
            kept_destinations.append(destination)
        else:
            dropped.append(f"destination: {destination}")

    kept_countries: list[str] = []
    for code in proposal.destination_countries:
        if not supported_countries or code.strip().upper() in supported_countries:
            kept_countries.append(code)
        else:
            dropped.append(f"destination country: {code}")

    return proposal.model_copy(
        update={
            "academic_interests": kept_interests,
            "destinations": kept_destinations,
            "destination_countries": kept_countries,
            "dropped": proposal.dropped + dropped,
        }
    )
