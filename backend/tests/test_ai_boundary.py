"""The AI/deterministic boundary.

The rule is that the model may *propose* and only deterministic services
may *decide*. These tests check that the rule is true of the code, not
merely of the documentation:

- every stage declares an owner;
- an AI stage's module does not import the decision types;
- an AI stage returns a proposal, never a decision;
- the three stages the brief names as deterministic have no model
  dependency at all.
"""

from __future__ import annotations

import ast
import inspect
import sys
from pathlib import Path
from typing import get_args, get_origin, get_type_hints

import pytest

from app.ai import boundary
from app.ai.decisions import DecisionRecord, MatchDecision, NextActionDecision, RequirementDecision
from app.ai.stages import (
    draft,
    explanation,
    institution,
    matching,
    mission,
    next_action,
    requirements,
    retrieval,
)
from app.ai.stages.base import ProposalStage, Stage, StageOwner
from app.ai.types import Proposal

STAGE_MODULES = (
    mission,
    requirements,
    retrieval,
    explanation,
    matching,
    next_action,
    draft,
    institution,
)

AI_STAGES = (
    mission.MissionInterpretationStage,
    requirements.RequirementExtractionStage,
    explanation.EvidenceGroundedExplanationStage,
    draft.DraftProposalStage,
    institution.InstitutionAnswerStage,
)

DETERMINISTIC_STAGES = (
    retrieval.SourceRetrievalStage,
    matching.ConfirmedProfileMatchingStage,
    next_action.NextActionDerivationStage,
)


def _module_source(module: object) -> str:
    """The source of a module, by object or by name."""
    if isinstance(module, str):
        module = sys.modules[module]

    path = Path(inspect.getfile(module))  # type: ignore[arg-type]
    return path.read_text(encoding="utf-8")


def _return_type(stage: type) -> object:
    """The declared return type of a stage, unwrapped from a generic alias."""
    hints = get_type_hints(stage.run)
    return_type = hints["return"]

    origin = get_origin(return_type)
    if origin is not None:
        args = get_args(return_type)
        return args[0] if args else origin

    return return_type


def test_every_stage_declares_an_owner() -> None:
    for stage in (*AI_STAGES, *DETERMINISTIC_STAGES):
        assert issubclass(stage, Stage)
        assert stage.owner in (StageOwner.AI, StageOwner.DETERMINISTIC)
        assert stage.name


def test_an_ai_stage_does_not_import_the_decision_types() -> None:
    for module in (mission, requirements, explanation, draft, institution):
        tree = ast.parse(_module_source(module))

        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                assert "decisions" not in (node.module or ""), (
                    f"{module.__name__} imports the decision types; an AI stage may not decide."
                )
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert "decisions" not in alias.name, (
                        f"{module.__name__} imports the decision types; an AI stage may not decide."
                    )


def test_an_ai_stage_returns_a_proposal() -> None:
    for stage in AI_STAGES:
        return_type = _return_type(stage)

        assert isinstance(return_type, type), f"{stage.__name__} has no declared return type"
        assert issubclass(return_type, Proposal), (
            f"{stage.__name__} returns {return_type}, which is not a proposal."
        )
        assert not issubclass(return_type, DecisionRecord)
        assert not issubclass(return_type, MatchDecision)
        assert not issubclass(return_type, NextActionDecision)
        assert not issubclass(return_type, RequirementDecision)


def test_a_deterministic_stage_never_asks_the_model() -> None:
    """A deterministic stage may use the search and fetch providers.

    It may not use the *model*: there is no prompt anywhere in it, and no
    way for the model to have an opinion.
    """
    for stage in DETERMINISTIC_STAGES:
        assert stage.owner is StageOwner.DETERMINISTIC

        tree = ast.parse(_module_source(stage.__module__))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                imported = node.module or ""
                for alias in node.names:
                    assert "ModelProvider" not in alias.name
                    assert "ModelRequest" not in alias.name
                assert "ModelProvider" not in imported
                assert "ModelRequest" not in imported
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert "ModelProvider" not in alias.name
                    assert "ModelRequest" not in alias.name


def test_the_boundary_table_covers_every_stage() -> None:
    stage_names = {stage.name for stage in (*AI_STAGES, *DETERMINISTIC_STAGES)}

    for name in stage_names:
        assert boundary.owner_of(name) is not None, f"{name} is not in the boundary table."


def test_the_boundary_table_names_the_three_deterministic_stages() -> None:
    # The brief: retrieval, age calculation and the eligibility decision are
    # not the model's to make.
    deterministic = boundary.deterministic_decisions()

    assert "source_retrieval" in deterministic
    assert "age_calculation" in deterministic
    assert "confirmed_profile_matching" in deterministic
    assert "next_action_derivation" in deterministic


def test_every_boundary_rule_explains_itself() -> None:
    for rule in boundary.BOUNDARY:
        assert rule.why
        assert rule.enforced_by


def test_an_ai_stage_is_a_proposal_stage() -> None:
    for stage in AI_STAGES:
        assert issubclass(stage, ProposalStage)


@pytest.mark.parametrize("stage", AI_STAGES, ids=lambda stage: stage.__name__)
def test_an_ai_stage_never_returns_a_decision_type(stage: type) -> None:
    return_type = _return_type(stage)

    for decision_type in (DecisionRecord, MatchDecision, NextActionDecision, RequirementDecision):
        assert not issubclass(return_type, decision_type)
