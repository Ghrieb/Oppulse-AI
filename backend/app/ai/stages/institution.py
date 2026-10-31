"""The institution answer.

The model reads what the official pages state about the institution behind
a call: what it runs, and where. What it may *not* do is estimate anything
the sources leave unsaid — competitiveness, acceptance rates and funding
odds go into ``unverified``, named rather than invented.

Location, country, evidence and media are assembled deterministically by
the caller; this stage only proposes the prose.
"""

from __future__ import annotations

from typing import Any, ClassVar

from ..providers.base import ModelProvider
from ..types import InstitutionProposal, ModelRequest
from .base import ProposalStage


class InstitutionAnswerStage(ProposalStage):
    """Describes an institution from the pages that were actually reached."""

    name: ClassVar[str] = "institution"

    def __init__(self, model: ModelProvider) -> None:
        self._model = model

    async def run(self, payload: dict[str, Any]) -> InstitutionProposal:
        institution = str(payload.get("institution", ""))
        programme = str(payload.get("programme", ""))
        summary = str(payload.get("summary", ""))
        country = str(payload.get("country", ""))

        request = ModelRequest(
            stage=self.name,
            instruction=(
                "Describe this institution and its programme from the record below. Do not "
                "attribute a statement to a web page: the pages that were reached are shown "
                "separately, with their own evidence. List separately what a prospective "
                "applicant would want to know that the record does not state - do not "
                "estimate it."
            ),
            context={
                "institution": institution,
                "programme": programme,
                "summary": summary,
                "country": country,
            },
            response_schema="InstitutionProposal",
        )

        response = await self._model.complete(request)
        return InstitutionProposal.model_validate(response.parsed)
