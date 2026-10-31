"""Stage: document overview extraction.

The model reads the text of an uploaded document and proposes a short
overview plus the key notes a student would want on their profile. The
deterministic part is everything else: nothing is saved unless the student
confirms, and a provider failure leaves the profile untouched.
"""

from __future__ import annotations

from typing import Any, ClassVar

from ..providers.base import ModelProvider
from ..types import DocumentOverviewProposal, ModelRequest
from .base import ProposalStage


class DocumentOverviewStage(ProposalStage):
    """Summarises an uploaded document into an overview and notes."""

    name: ClassVar[str] = "document_overview"

    def __init__(self, model: ModelProvider) -> None:
        self._model = model

    async def run(self, payload: dict[str, Any]) -> DocumentOverviewProposal:
        text = str(payload.get("text", ""))

        request = ModelRequest(
            stage=self.name,
            instruction=(
                "Read this document and propose a concise professional overview (2-3 "
                "sentences) and a short list of key notes or skills. Do not invent "
                "anything the document does not state."
            ),
            context={"text": text[:4000]},
            response_schema="DocumentOverviewProposal",
        )

        response = await self._model.complete(request)
        return DocumentOverviewProposal.model_validate(response.parsed)
