"""The seven typed stages.

Each stage takes a typed input and returns a typed output. Three of them
are deterministic — the agent may not influence them at all — and four
produce *proposals*, which a later deterministic service validates,
narrows or rejects.

The stage order is the one in the brief:

    mission interpretation
    → requirement extraction
    → source retrieval and normalisation
    → evidence-grounded explanation
    → confirmed-profile matching
    → next-action derivation
    → draft proposal
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from enum import StrEnum
from typing import Any, ClassVar

from ..types import Proposal


class StageOwner(StrEnum):
    """Who is allowed to influence a stage.

    ``AI`` means the model may propose. ``DETERMINISTIC`` means the model
    has no say at all: the answer is a function of the confirmed profile
    and the rules, and the same inputs always give the same answer.
    """

    AI = "ai"
    DETERMINISTIC = "deterministic"


class Stage(ABC):
    """One stage of the agent."""

    #: The stage's name, used in the run events and in the corpus.
    name: ClassVar[str] = ""

    #: Who may influence it.
    owner: ClassVar[StageOwner] = StageOwner.DETERMINISTIC

    @abstractmethod
    async def run(self, payload: dict[str, Any]) -> Any:
        """Runs the stage."""
        raise NotImplementedError


class ProposalStage(Stage):
    """A stage the model may influence.

    Its output is always a proposal: something the agent suggests, which
    the deterministic services then check. A stage that proposes several
    things at once returns a list of them.
    """

    owner: ClassVar[StageOwner] = StageOwner.AI

    @abstractmethod
    async def run(self, payload: dict[str, Any]) -> Proposal | list[Proposal]:
        """Runs the stage, and proposes."""
        raise NotImplementedError
