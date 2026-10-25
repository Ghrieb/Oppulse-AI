"""Stage 7 — the draft proposal.

The model writes the document. The deterministic part is the grounding
check: a claim the agent could not trace to a confirmed fact is marked as
uncertain, and the student sees it in the diff before anything is applied.

The output is a proposal. It never becomes the student's document without
their acceptance.
"""

from __future__ import annotations

import re
from typing import Any, ClassVar

from ..providers.base import ModelProvider
from ..types import DraftProposal, ModelRequest
from .base import ProposalStage

#: The markers a model uses for something it is not sure about.
UNCERTAIN_MARKERS = ("[unverified]", "[needs a source]", "[uncertain]")


class DraftProposalStage(ProposalStage):
    """Drafts a document from the confirmed facts."""

    name: ClassVar[str] = "draft_proposal"

    def __init__(self, model: ModelProvider) -> None:
        self._model = model

    async def run(self, payload: dict[str, Any]) -> DraftProposal:
        instruction = str(payload.get("instruction", ""))
        confirmed_facts: list[dict[str, Any]] = list(payload.get("confirmedFacts", []))
        excluded_facts: list[dict[str, Any]] = list(payload.get("excludedFacts", []))

        request = ModelRequest(
            stage=self.name,
            instruction=(
                "Draft the document using only the confirmed facts below. Mark anything you "
                "cannot ground with [unverified]. Do not claim an achievement that is not in "
                "the confirmed facts."
            ),
            context={
                "instruction": instruction,
                "confirmedFacts": confirmed_facts,
                "documentType": payload.get("documentType"),
            },
            response_schema="DraftProposal",
        )

        response = await self._model.complete(request)
        proposed = DraftProposal.model_validate(response.parsed)

        grounded_ids = [
            str(fact.get("id")) for fact in confirmed_facts if fact.get("id") is not None
        ]
        unsupported = list(proposed.unsupported_claims)
        unsupported.extend(_ungrounded_claims(proposed.content, grounded_ids))

        # A fact the student excluded must never appear in the draft. If it
        # does, the draft says so rather than quietly keeping it.
        leaked = [
            str(fact.get("label", fact.get("id", "")))
            for fact in excluded_facts
            if _mentions(proposed.content, fact)
        ]
        unsupported.extend(f"mentions an excluded fact: {label}" for label in leaked)

        return proposed.model_copy(
            update={
                "unsupported_claims": unsupported,
                "grounded_fact_ids": grounded_ids,
                "summary": (
                    proposed.summary
                    or ("The draft is grounded in your confirmed facts." if not unsupported else "")
                ),
            }
        )


def _mentions(content: str, fact: dict[str, Any]) -> bool:
    """Whether a fact's own value appears in the draft."""
    value = str(fact.get("value", "")).strip()
    if not value:
        return False
    return value.lower() in content.lower()


def _ungrounded_claims(content: str, grounded_fact_ids: list[str]) -> list[str]:
    """The sentences that name no grounded fact and carry no uncertainty marker.

    A sentence that states an achievement — a number, a named institution,
    a title — must be traceable to a confirmed fact. This is a *marker* for
    the student to check, not a proof: the review is theirs.
    """
    suspicious = re.compile(
        r"\b(led|managed|published|won|achieved|increased by|delivered|built|"
        r"secured|received|improved|reduced)\b",
        re.IGNORECASE,
    )

    ungrounded: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+", content):
        stripped = sentence.strip()
        if not stripped or not suspicious.search(stripped):
            continue
        if any(marker in stripped for marker in UNCERTAIN_MARKERS):
            continue
        ungrounded.append(stripped)

    return ungrounded
