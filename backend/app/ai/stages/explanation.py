"""Stage 4 — the evidence-grounded explanation.

The model writes the prose; the deterministic part decides what survives.
A claim without a source id is dropped, and the no-admission-probability
rule is checked here rather than trusted.
"""

from __future__ import annotations

import re
from typing import Any, ClassVar

from ..providers.base import ModelProvider
from ..types import Claim, Explanation, ModelRequest, RequirementCandidate
from .base import ProposalStage

#: The phrases that turn a profile match into a promise of admission.
ADMISSION_PROMISES = (
    "guaranteed",
    "guarantee",
    "you will be accepted",
    "you will get in",
    "certain to be accepted",
    "acceptance likelihood",
    "chance of acceptance",
    "probability of acceptance",
    "likely to be admitted",
    "assured admission",
)

#: The phrases that describe a fit as a fit.
FIT_PHRASES = ("profile match", "fit", "match score", "how well you match")


class EvidenceGroundedExplanationStage(ProposalStage):
    """Explains what was found, with the sources attached."""

    name: ClassVar[str] = "evidence_grounded_explanation"

    def __init__(self, model: ModelProvider) -> None:
        self._model = model

    async def run(self, payload: dict[str, Any]) -> Explanation:
        requirements: list[RequirementCandidate] = list(payload.get("requirements", []))
        sources: list[dict[str, Any]] = list(payload.get("sources", []))

        request = ModelRequest(
            stage=self.name,
            instruction=(
                "Explain what this call requires, in plain language. Every sentence must be "
                "supported by one of the given sources. Do not describe a profile match as a "
                "likelihood of being admitted."
            ),
            context={
                "requirements": [
                    {
                        "id": requirement.label,
                        "clause": requirement.clause,
                        "passage": requirement.passage,
                    }
                    for requirement in requirements
                ],
                "sources": sources,
            },
            response_schema="Explanation",
        )

        response = await self._model.complete(request)
        proposed = Explanation.model_validate(response.parsed)

        known_source_ids = {str(source.get("id")) for source in sources}
        grounded: list[Claim] = []
        unsupported: list[str] = []

        for claim in proposed.claims:
            if claim.source_id not in known_source_ids:
                unsupported.append(claim.text)
                continue
            if _promises_admission(claim.text):
                unsupported.append(claim.text)
                continue
            grounded.append(claim)

        return proposed.model_copy(
            update={"claims": grounded, "unsupported": proposed.unsupported + unsupported}
        )


def _promises_admission(text: str) -> bool:
    """Whether a sentence turns a match into a promise.

    A profile match is a fit, never a likelihood of being admitted, and the
    interface must never say otherwise.
    """
    lowered = text.lower()
    if any(phrase in lowered for phrase in ADMISSION_PROMISES):
        return True

    # "You are a strong match" is fine. "You have a 90% chance" is not.
    return bool(re.search(r"\b\d{1,3}\s?%\s*(chance|likelihood|probability)", lowered))
