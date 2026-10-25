"""Stage 6 — the next-action derivation.

Not an AI stage. The model may suggest candidates, but the *priority
function* selects the action: the same inputs always produce the same
recommendation, and it is always tied to a real blocker.
"""

from __future__ import annotations

from typing import Any, ClassVar

from ..decisions import NextActionDecision
from ..rules.next_action import derive_next_action
from .base import Stage


class NextActionDerivationStage(Stage):
    """Derives the one action the student should take next."""

    name: ClassVar[str] = "next_action_derivation"

    async def run(self, payload: dict[str, Any]) -> NextActionDecision | None:
        action = derive_next_action(
            profile=payload.get("profile"),
            opportunities=list(payload.get("opportunities", [])),
            applications=list(payload.get("applications", [])),
            drafts=list(payload.get("drafts", [])),
            sources=list(payload.get("sources", [])),
            alerts=list(payload.get("alerts", [])),
            documents=list(payload.get("documents", [])),
            now=str(payload.get("now", "")),
        )

        if action is None:
            return None

        return NextActionDecision(
            id=str(action.get("id", "")),
            kind=action.get("kind", "check_source"),
            title=str(action.get("title", "")),
            rationale=str(action.get("rationale", "")),
            cta=str(action.get("cta", "")),
            route=str(action.get("route", "")),
            priority=int(action.get("priority", 0)),
            blocker_id=action.get("blockerId"),
            created_at=str(action.get("createdAt", "")),
        )
