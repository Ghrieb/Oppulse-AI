"""The shared rule cases.

One file of cases, two implementations. The TypeScript in the frontend is
the reference: its answers are recorded in ``contracts/rule-cases.json``, and
this test asserts the Python implementation against the same file. A
divergence fails both suites, in CI, on the case that disagrees.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.ai.rules.completeness import compute_completeness
from app.ai.rules.ids import deterministic_uuid
from app.ai.rules.matching import evaluate_requirement, recompute_all
from app.ai.rules.next_action import derive_next_action

CASES_PATH = Path(__file__).resolve().parents[2] / "contracts" / "rule-cases.json"


def load_cases() -> list[dict[str, Any]]:
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))["cases"]


def compute(case: dict[str, Any]) -> dict[str, Any] | None:
    """The Python answer for one case."""
    kind = case["kind"]
    data = case["input"]

    if kind == "requirement":
        result = evaluate_requirement(
            data["requirement"],
            data.get("profile"),
            data.get("protectedProfile"),
        )
        return {"status": result["status"], "explanation": result["explanation"]}

    if kind == "next_action":
        return derive_next_action(
            profile=data.get("profile"),
            opportunities=data.get("opportunities", []),
            applications=data.get("applications", []),
            drafts=data.get("drafts", []),
            sources=data.get("sources", []),
            alerts=data.get("alerts", []),
            now=data["now"],
        )

    completeness = compute_completeness(data.get("profile"))
    return {
        "confirmed": completeness["confirmed"],
        "required": completeness["required"],
        "percent": completeness["percent"],
        "summary": completeness["summary"],
    }


def test_the_case_file_has_the_expected_shape() -> None:
    cases = load_cases()

    assert len(cases) > 10
    for case in cases:
        assert case["name"]
        assert case["kind"] in {"requirement", "next_action", "completeness"}
        # "No next action" is a recorded answer too: the expectation is null.
        if case["kind"] != "next_action":
            assert case["expected"] is not None, f"{case['name']} has no recorded expectation"


@pytest.mark.parametrize("case", load_cases(), ids=lambda case: case["name"])
def test_the_python_implementation_agrees_with_the_reference(case: dict[str, Any]) -> None:
    assert compute(case) == case["expected"]


def test_the_deterministic_identifier_matches_the_frontend() -> None:
    # The same seed, the same UUID: the frontend and the backend must derive
    # the same identifiers for the same derived records.
    assert deterministic_uuid("confirm-fact:abc") == "e28a3e46-d0cf-4f2b-9dcd-bde82f1a94ad"


def test_recompute_returns_the_same_shape_as_the_frontend() -> None:
    opportunities = [
        {
            "id": "d4000000-0000-4000-8000-000000000001",
            "title": "Helios",
            "requirements": [
                {
                    "id": "50000000-0000-4000-8000-000000000004",
                    "label": "English proficiency",
                    "kind": "language",
                    "status": "unresolved",
                    "sourceClause": None,
                    "evidenceIds": [],
                    "profileFactKey": "english_level",
                    "check": {"factKey": "english_level", "kind": "at_least", "value": 6.5},
                    "ageRule": None,
                    "blocking": True,
                    "explanation": "",
                }
            ],
        }
    ]
    matches = [
        {
            "id": "5e000000-0000-4000-8000-000000000001",
            "opportunityId": "d4000000-0000-4000-8000-000000000001",
            "fitScore": 80,
            "eligibility": "unresolved",
            "warnings": [],
            "confidence": "medium",
            "reasons": [],
        }
    ]
    profile = {
        "facts": [
            {
                "key": "english_level",
                "label": "English (CEFR)",
                "value": "B2 (IELTS 6.5)",
                "numericValue": 6.5,
                "code": "B2",
                "status": "confirmed",
                "excluded": False,
                "source": None,
            }
        ]
    }

    recomputed = recompute_all(opportunities, matches, profile)

    assert set(recomputed) == {"opportunities", "matches"}
    assert recomputed["opportunities"][0]["requirements"][0]["status"] == "likely"
    assert recomputed["matches"][0]["eligibility"] == "likely"
    assert recomputed["matches"][0]["warnings"] == []
